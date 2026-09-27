<template>
  <div class="location-view">
    <div ref="stage" class="stage" />

    <header class="hud-top">
      <button class="btn small" @click="back">◀ Globo</button>
      <div class="place">
        <b>{{ location?.name }}</b>
      </div>
      <div class="stats">💰 {{ game.progress.zeni }}</div>
    </header>

    <section v-if="game.activeMission && game.activeMission.locationId === id" class="tracker card">
      <b>⭐ {{ game.activeMission.title }}</b>
      <span>{{ game.currentStep?.hint }}</span>
    </section>

    <section v-else-if="available.length" class="board card">
      <b>Misiones aquí</b>
      <div v-for="m in available" :key="m.id" class="mission">
        <div>
          <div class="m-title">{{ m.title }}</div>
          <small>{{ m.summary }}</small>
        </div>
        <button class="btn primary small" @click="game.startMission(m.id)">Empezar</button>
      </div>
    </section>

    <footer class="hud-bottom">
      <div class="team">
        <button v-for="c in game.progress.team" :key="c" class="chip" :class="{ on: c === game.progress.character }"
          @click="switchCharacter(c)">{{ CHARACTERS[c]?.name || c }}</button>
      </div>
      <div v-if="settings.moveMode === 'dice'" class="dice-box">
        <span>Pasos: {{ moves }}</span>
        <button class="btn primary small" :disabled="moves > 0 || rolling" @click="roll">🎲 {{ rolling ? '...' : 'Tirar' }}</button>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import * as THREE from 'three'
import { getLocation } from '../data/worlds.js'
import { MAPS, TILES } from '../data/maps.js'
import { CHARACTERS } from '../data/characters.js'
import { useGameStore } from '../stores/game.js'
import { useSettingsStore } from '../stores/settings.js'
import { createRetroRenderer, pointerNDC } from '../engine/retro.js'
import { characterModel, propModel, treeModel } from '../engine/models.js'
import { findPath, isLocationUnlocked } from '../engine/missionLogic.js'
import { chiptune } from '../engine/chiptune.js'

const props = defineProps({ id: { type: String, required: true } })
const game = useGameStore()
const settings = useSettingsStore()
const router = useRouter()

const stage = ref(null)
const moves = ref(0)
const rolling = ref(false)
const location = computed(() => getLocation(props.id))
const map = MAPS[props.id]
const available = computed(() => game.availableAt(props.id))

let r3, scene, camera, raf, player, tileMesh, highlight
let propObjs = new Map() // id → { prop, obj }
let pos = [...(map?.start || [0, 0])]
let walkQueue = []
let walkT = 0
let pendingInteract = null
const W = map ? map.tiles[0].length : 0
const H = map ? map.tiles.length : 0

const tileAt = (x, y) => TILES[map.tiles[y]?.[x]]
const occupied = (x, y) => [...propObjs.values()].some(({ prop }) => prop.x === x && prop.y === y)
const blocked = (x, y) => !tileAt(x, y)?.walk || occupied(x, y)
const worldPos = (x, y) => new THREE.Vector3(x - W / 2 + 0.5, 0, y - H / 2 + 0.5)

function back () {
  if (game.battle || game.dialog) return
  router.push({ name: 'globe' })
}

function buildTiles () {
  const box = new THREE.BoxGeometry(1, 1, 1)
  tileMesh = new THREE.InstancedMesh(box, new THREE.MeshLambertMaterial(), W * H)
  tileMesh.receiveShadow = true
  const m = new THREE.Matrix4()
  const c = new THREE.Color()
  let i = 0
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const t = tileAt(x, y)
      const p = worldPos(x, y)
      m.makeScale(1, t.h, 1)
      m.setPosition(p.x, t.h / 2 - 0.3, p.z)
      tileMesh.setMatrixAt(i, m)
      // tablero ajedrezado sutil para leer bien las casillas (modo dados)
      c.set(t.color).offsetHSL(0, 0, (x + y) % 2 ? 0.03 : -0.02)
      tileMesh.setColorAt(i, c)
      tileMesh.userData[i] = [x, y]
      i++
      if (t.tree) {
        const tree = treeModel()
        tree.position.set(p.x, 0, p.z)
        scene.add(tree)
      }
      if (t.cloud && Math.random() < 0.35) {
        const puff = new THREE.Mesh(box, new THREE.MeshLambertMaterial({ color: '#ffffff' }))
        puff.scale.set(0.8, 0.3, 0.6)
        puff.position.set(p.x, 0.05, p.z)
        scene.add(puff)
      }
    }
  }
  scene.add(tileMesh)
  // mar alrededor para que el escenario no "flote" en el vacío
  const sea = new THREE.Mesh(new THREE.BoxGeometry(W + 30, 0.2, H + 30),
    new THREE.MeshLambertMaterial({ color: props.id === 'karin' ? '#bfe3ff' : '#2b7bd6' }))
  sea.position.y = -0.4
  scene.add(sea)
  highlight = new THREE.Group()
  scene.add(highlight)
}

function syncProps () {
  const wanted = [...map.props, ...game.spawnsAt(props.id)]
  const ids = new Set(wanted.map(p => p.id))
  for (const [id, { obj }] of propObjs) {
    if (!ids.has(id)) { scene.remove(obj); propObjs.delete(id) }
  }
  for (const prop of wanted) {
    if (propObjs.has(prop.id)) continue
    const obj = propModel(prop)
    const p = worldPos(prop.x, prop.y)
    obj.position.set(p.x, tileAt(prop.x, prop.y).h - 0.3, p.z)
    obj.traverse(o => { o.userData.propId = prop.id })
    obj.userData.baseY = obj.position.y
    obj.userData.bob = prop.kind === 'npc' || prop.kind === 'ball' || prop.kind === 'bean'
    scene.add(obj)
    propObjs.set(prop.id, { prop, obj })
  }
  markTarget()
}

// Marca con una flecha el objetivo del paso actual de la misión
let arrow
function markTarget () {
  if (!arrow) {
    arrow = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.35, 4), new THREE.MeshBasicMaterial({ color: '#ffd23c' }))
    arrow.rotation.x = Math.PI
    scene.add(arrow)
  }
  const target = game.activeMission?.locationId === props.id ? game.currentStep?.target : null
  const entry = target && propObjs.get(target)
  arrow.visible = Boolean(entry)
  if (entry) {
    const p = worldPos(entry.prop.x, entry.prop.y)
    arrow.position.set(p.x, 1.6, p.z)
  }
}

function makePlayer () {
  if (player) scene.remove(player)
  player = characterModel(game.progress.character, 0.055)
  player.castShadow = true
  const p = worldPos(...pos)
  player.position.set(p.x, tileAt(...pos).h - 0.3, p.z)
  scene.add(player)
}

function switchCharacter (c) {
  game.progress.character = c
  game.save()
  makePlayer()
}

function showReachable () {
  highlight.clear()
  if (settings.moveMode !== 'dice' || moves.value <= 0) return
  // BFS limitado para pintar casillas alcanzables
  const seen = new Map([[pos.join(','), 0]])
  const q = [[...pos]]
  while (q.length) {
    const [x, y] = q.shift()
    const d = seen.get(`${x},${y}`)
    if (d >= moves.value) continue
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx; const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || blocked(nx, ny) || seen.has(`${nx},${ny}`)) continue
      seen.set(`${nx},${ny}`, d + 1)
      q.push([nx, ny])
    }
  }
  const mat = new THREE.MeshBasicMaterial({ color: '#ffe066', transparent: true, opacity: 0.75 })
  const geo = new THREE.BoxGeometry(0.9, 0.04, 0.9)
  for (const k of seen.keys()) {
    const [x, y] = k.split(',').map(Number)
    const p = worldPos(x, y)
    const m = new THREE.Mesh(geo, mat)
    m.position.set(p.x, tileAt(x, y).h - 0.28, p.z)
    highlight.add(m)
  }
}

function roll () {
  rolling.value = true
  let n = 0
  const iv = setInterval(() => {
    moves.value = 1 + Math.floor(Math.random() * 6)
    chiptune.sfx('step')
    if (++n > 8) {
      clearInterval(iv)
      rolling.value = false
      chiptune.sfx('dice')
      game.flash(`¡Has sacado un ${moves.value}!`)
      showReachable()
    }
  }, 70)
}

function goTo (target, interactWith = null) {
  let dest = target
  if (interactWith) {
    // ya al lado → interactuar directamente
    if (Math.abs(interactWith.x - pos[0]) + Math.abs(interactWith.y - pos[1]) === 1) {
      face(interactWith.x, interactWith.y)
      game.interact(interactWith)
      return
    }
    const options = [[1, 0], [-1, 0], [0, 1], [0, -1]]
      .map(([dx, dy]) => [interactWith.x + dx, interactWith.y + dy])
      .filter(([x, y]) => x >= 0 && y >= 0 && x < W && y < H && !blocked(x, y))
      .map(p => ({ p, path: findPath(W, H, blocked, pos, p) }))
      .filter(o => o.path)
      .sort((a, b) => a.path.length - b.path.length)
    if (!options.length) { game.flash('No puedo llegar hasta ahí'); return }
    dest = options[0].p
  }
  const path = findPath(W, H, blocked, pos, dest)
  if (!path) { game.flash('No puedo llegar hasta ahí'); return }
  if (settings.moveMode === 'dice') {
    if (moves.value <= 0) { game.flash('Tira el dado para moverte 🎲'); return }
    if (path.length > moves.value) { game.flash(`Necesitas ${path.length} pasos (tienes ${moves.value})`); return }
    moves.value -= path.length
  }
  walkQueue = path
  walkT = 0
  pendingInteract = interactWith
  highlight.clear()
}

function face (x, y) {
  const a = worldPos(...pos)
  const b = worldPos(x, y)
  player.rotation.y = Math.atan2(b.x - a.x, b.z - a.z)
}

function stepWalk (dt) {
  if (!walkQueue.length) return
  const [nx, ny] = walkQueue[0]
  const a = worldPos(...pos)
  const b = worldPos(nx, ny)
  walkT += dt * 5
  const t = Math.min(1, walkT)
  face(nx, ny)
  player.position.x = a.x + (b.x - a.x) * t
  player.position.z = a.z + (b.z - a.z) * t
  player.position.y = tileAt(nx, ny).h - 0.3 + Math.abs(Math.sin(t * Math.PI)) * 0.12
  if (t >= 1) {
    pos = [nx, ny]
    walkQueue.shift()
    walkT = 0
    chiptune.sfx('step')
    if (!walkQueue.length) {
      if (pendingInteract) {
        const target = pendingInteract
        pendingInteract = null
        face(target.x, target.y)
        game.interact(target)
      }
      showReachable()
    }
  }
}

const raycaster = new THREE.Raycaster()
let down = null
function onDown (e) { down = { x: e.clientX, y: e.clientY } }
function onUp (e) {
  if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 10) { down = null; return }
  down = null
  if (game.dialog || game.battle || walkQueue.length) return
  raycaster.setFromCamera(pointerNDC(e, r3.canvas), camera)
  const objs = [...[...propObjs.values()].map(v => v.obj), tileMesh]
  const hit = raycaster.intersectObjects(objs, true)[0]
  if (!hit) return
  const propId = hit.object.userData.propId
  if (propId) { goTo(null, propObjs.get(propId).prop); return }
  if (hit.object === tileMesh) {
    const [x, y] = tileMesh.userData[hit.instanceId]
    if (!blocked(x, y)) goTo([x, y])
  }
}

onMounted(() => {
  if (!map || !location.value || !isLocationUnlocked(location.value, game.progress.completed)) {
    router.replace({ name: 'globe' })
    return
  }
  r3 = createRetroRenderer(stage.value, { pixelScale: settings.pixelScale })
  scene = new THREE.Scene()
  scene.background = new THREE.Color(props.id === 'karin' ? '#8fc8ff' : '#79c7ff')
  const aspect = 1
  const zoom = 5.2
  camera = new THREE.OrthographicCamera(-zoom * aspect, zoom * aspect, zoom, -zoom, 0.1, 100)
  r3.onResize = (w, h) => {
    const a = w / h
    const z = a < 1 ? Math.max(6.5, 4.6 / a) : 5.5
    camera.left = -z * a; camera.right = z * a; camera.top = z; camera.bottom = -z
    camera.updateProjectionMatrix()
  }
  scene.add(new THREE.HemisphereLight('#ffffff', '#6a8a5a', 1.6))
  const sun = new THREE.DirectionalLight('#fff4d6', 2)
  sun.position.set(-6, 12, 8)
  sun.castShadow = true
  sun.shadow.mapSize.set(512, 512)
  Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12 })
  scene.add(sun)

  buildTiles()
  syncProps()
  makePlayer()

  r3.canvas.addEventListener('pointerdown', onDown)
  r3.canvas.addEventListener('pointerup', onUp)

  let last = performance.now()
  let t = 0
  const camTarget = new THREE.Vector3()
  const loop = () => {
    const now = performance.now()
    const dt = Math.min((now - last) / 1000, 0.05)
    last = now
    t += dt
    stepWalk(dt)
    for (const { obj } of propObjs.values()) {
      if (obj.userData.bob) obj.position.y = obj.userData.baseY + Math.abs(Math.sin(t * 2.5 + obj.id)) * 0.05
    }
    if (arrow?.visible) arrow.position.y = 1.5 + Math.sin(t * 4) * 0.12
    camTarget.lerp(player.position, 0.1)
    camera.position.set(camTarget.x + 8, camTarget.y + 9, camTarget.z + 8)
    camera.lookAt(camTarget)
    r3.renderer.render(scene, camera)
    raf = requestAnimationFrame(loop)
  }
  camTarget.copy(player.position)
  loop()
  chiptune.play(map.music)
})

// cambios de misión (nuevo paso, spawns) → refrescar escena
watch(() => [game.progress.active?.missionId, game.progress.active?.step, game.progress.completed.length], () => {
  if (scene) syncProps()
})
watch(() => game.battle, b => { if (!b && scene) chiptune.play(map.music) })

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  r3?.dispose()
})
</script>

<style scoped>
.location-view { position: fixed; inset: 0; }
.stage { position: absolute; inset: 0; }
.hud-top {
  position: absolute; top: 0; left: 0; right: 0; display: flex; justify-content: space-between; align-items: center;
  padding: calc(env(safe-area-inset-top) + 10px) 12px 0; gap: 8px;
}
.place b { font-size: 12px; color: var(--yellow); text-shadow: 2px 2px 0 #000; }
.stats { font-size: 10px; text-shadow: 2px 2px 0 #000; }
.tracker, .board {
  position: absolute; top: calc(env(safe-area-inset-top) + 50px); left: 12px; right: 12px; max-width: 460px; margin: 0 auto;
  font-size: 9px; line-height: 1.6; display: flex; flex-direction: column; gap: 4px;
}
.tracker b, .board > b { color: var(--yellow); font-size: 10px; }
.mission { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
.m-title { font-size: 10px; }
.mission small { opacity: .8; }
.hud-bottom {
  position: absolute; left: 0; right: 0; bottom: 0; display: flex; justify-content: space-between; align-items: flex-end;
  padding: 8px 12px calc(env(safe-area-inset-bottom) + 10px); gap: 8px;
}
.team { display: flex; gap: 6px; flex-wrap: wrap; }
.dice-box { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; font-size: 10px; text-shadow: 2px 2px 0 #000; }
</style>
