<template>
  <div class="globe-view">
    <div ref="stage" class="stage" />

    <header class="hud-top">
      <div class="worlds">
        <button v-for="w in WORLDS" :key="w.id" class="chip"
          :class="{ on: w.id === viewWorld.id, locked: w.locked }" @click="switchWorld(w.id)">
          {{ w.locked ? '🔒 ' : '' }}{{ w.name }}
        </button>
      </div>
      <div class="stats">
        <span>💰 {{ game.progress.zeni }}</span>
        <span>🟠 {{ balls }}</span>
        <router-link to="/ajustes" class="icon-btn" aria-label="Ajustes">⚙</router-link>
      </div>
    </header>

    <div class="world-title">
      <b>{{ viewWorld.name }}</b>
      <small>{{ viewWorld.saga }} · {{ viewWorld.timeline }}</small>
    </div>

    <transition name="slide">
      <section v-if="selected" class="panel card">
        <div class="panel-head">
          <h2>{{ selected.name }}</h2>
          <button class="icon-btn" @click="selected = null">✕</button>
        </div>
        <p>{{ selected.desc }}</p>

        <template v-if="viewWorld.locked">
          <p class="muted">🔒 Mundo bloqueado — llegará en un pack de misiones (DLC).</p>
        </template>
        <template v-else-if="!unlocked(selected)">
          <p class="muted">🔒 Completa antes: «{{ requiredTitle(selected) }}»</p>
        </template>
        <template v-else>
          <ul class="missions" v-if="game.availableAt(selected.id).length">
            <li v-for="m in game.availableAt(selected.id)" :key="m.id">⭐ {{ m.title }}</li>
          </ul>
          <p v-else class="muted">No hay misiones nuevas aquí... de momento.</p>

          <div class="actions">
            <button v-if="isHere(selected)" class="btn primary" @click="enter(selected)">Entrar ▶</button>
            <template v-else-if="settings.moveMode === 'free'">
              <button class="btn primary" :disabled="traveling" @click="flyTo(selected)">☁ Volar en la Nube Kinton</button>
            </template>
            <template v-else>
              <button class="btn primary" :disabled="traveling" @click="rollAndMove(selected)">
                🎲 Tirar dado
              </button>
              <small v-if="transit && transit.to === selected.id" class="muted">
                Faltan {{ transit.points.length - transit.index }} casillas
              </small>
            </template>
          </div>
        </template>
      </section>
    </transition>

    <div v-if="die" class="die-overlay"><div class="die" :class="{ rolling: die.rolling }">{{ die.value }}</div></div>

    <footer class="hud-bottom">
      <span class="muted">Arrastra para girar · Toca un lugar</span>
      <span class="mode">Modo: {{ settings.moveMode === 'dice' ? '🎲 Dados' : '🕊 Libre' }}</span>
    </footer>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { useRouter } from 'vue-router'
import * as THREE from 'three'
import { WORLDS, getWorld } from '../data/worlds.js'
import { useGameStore } from '../stores/game.js'
import { useSettingsStore } from '../stores/settings.js'
import { useMissionsStore } from '../stores/missions.js'
import { createRetroRenderer, pointerNDC } from '../engine/retro.js'
import { buildPlanet, surfacePoint, latLonToDir, greatCirclePoints, starfield } from '../engine/globe.js'
import { characterModel, kintonModel, propModel } from '../engine/models.js'
import { isLocationUnlocked } from '../engine/missionLogic.js'
import { chiptune } from '../engine/chiptune.js'

const game = useGameStore()
const settings = useSettingsStore()
const missions = useMissionsStore()
const router = useRouter()

const stage = ref(null)
const selected = ref(null)
const traveling = ref(false)
const die = ref(null)
const transit = ref(null) // { to, points: [dir], index }
const viewWorld = shallowRef(getWorld(game.progress.worldId) || WORLDS[0])

const balls = computed(() => game.progress.inventory.filter(i => i.startsWith('esfera_')).length + '/7')

const ENCOUNTERS = [
  'Te cruzas con Yamcha en el desierto. Se pone rojo y huye. +10 zenis',
  'Un pterodáctilo te adelanta. Le ganas. +10 zenis',
  'Encuentras una cápsula perdida... ¡es una nevera llena! +10 zenis',
  'El Ejército Red Ribbon patrulla a lo lejos. Mejor seguir. +10 zenis',
  'Puar se transforma en nube para volar a tu lado un rato. +10 zenis'
]

let r3, scene, camera, world3, planet, player, raf, refit
let markers = []
let waypointGroup
const followQ = new THREE.Quaternion()
let autoFollow = true
let playerDir = new THREE.Vector3(0, 1, 0)

const unlocked = loc => isLocationUnlocked(loc, game.progress.completed)
const isHere = loc => game.progress.worldId === viewWorld.value.id && game.progress.locationId === loc.id && !transit.value
const requiredTitle = loc => missions.byId(loc.requires)?.title || loc.requires

function buildWorld () {
  if (world3) scene.remove(world3)
  const w = viewWorld.value
  world3 = new THREE.Group()
  planet = buildPlanet(w)
  world3.add(planet)
  scene.background = new THREE.Color(w.sky)
  markers = []
  for (const loc of w.locations) {
    const pos = surfacePoint(w, loc.lat, loc.lon)
    const dir = pos.clone().normalize()
    const holder = new THREE.Group()
    holder.position.copy(pos)
    holder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.12, 6), new THREE.MeshLambertMaterial({ color: '#c9a36b', flatShading: true }))
    base.position.y = 0.02
    holder.add(base)
    const kind = { cabin: 'cabin', kamehouse: 'kamehouse', dome: 'dome', tower: 'tower' }[loc.landmark] || 'cabin'
    const model = propModel({ kind })
    model.scale.setScalar(kind === 'tower' ? 0.55 : 0.4)
    model.position.y = 0.08
    holder.add(model)
    const locked = w.locked || !unlocked(loc)
    const beacon = new THREE.Mesh(new THREE.OctahedronGeometry(0.1), new THREE.MeshBasicMaterial({ color: locked ? '#777' : '#ffd23c' }))
    beacon.position.y = kind === 'tower' ? 1.3 : 0.75
    holder.add(beacon)
    // zona táctil generosa para dedos
    const hitArea = new THREE.Mesh(new THREE.SphereGeometry(0.75, 6, 4), new THREE.MeshBasicMaterial())
    hitArea.position.y = 0.4
    hitArea.visible = false
    holder.add(hitArea)
    holder.userData = { loc, beacon }
    holder.traverse(o => { o.userData.loc = loc })
    world3.add(holder)
    markers.push(holder)
  }
  waypointGroup = new THREE.Group()
  world3.add(waypointGroup)
  scene.add(world3)

  if (w.id === game.progress.worldId) {
    const here = w.locations.find(l => l.id === game.progress.locationId) || w.locations[0]
    playerDir = latLonToDir(here.lat, here.lon)
    if (!player) createPlayer()
    world3.add(player)
    player.visible = true
    placePlayer(playerDir)
    focusOn(playerDir, true)
  } else if (player) {
    player.visible = false
    focusOn(latLonToDir(w.locations[0].lat, w.locations[0].lon), true)
  }
}

function createPlayer () {
  player = new THREE.Group()
  const hero = characterModel(game.progress.character, 0.05)
  hero.position.y = 0.15
  const cloud = kintonModel()
  cloud.scale.setScalar(0.7)
  player.add(cloud, hero)
}

function placePlayer (dir) {
  const w = viewWorld.value
  player.position.copy(dir.clone().multiplyScalar(w.radius * 1.08 + 1.1))
  player.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize())
}

// Gira el mundo para que `dir` quede mirando a la cámara
function focusOn (dir, instant = false) {
  const target = new THREE.Vector3(0, 0.35, 1).normalize()
  followQ.setFromUnitVectors(dir.clone().normalize(), target)
  autoFollow = true
  if (instant) world3.quaternion.copy(followQ)
}

function switchWorld (id) {
  selected.value = null
  transit.value = null
  viewWorld.value = getWorld(id)
  buildWorld()
  refit?.()
}

function enter (loc) {
  chiptune.sfx('ok')
  router.push({ name: 'location', params: { id: loc.id } })
}

function animatePath (dirs, onDone) {
  traveling.value = true
  let i = 0
  const segDur = settings.moveMode === 'dice' ? 350 : 60
  const next = () => {
    if (i >= dirs.length) { traveling.value = false; onDone(); return }
    const from = playerDir.clone()
    const to = dirs[i]
    const t0 = performance.now()
    const tick = () => {
      const t = Math.min(1, (performance.now() - t0) / segDur)
      const q = new THREE.Quaternion().slerp(new THREE.Quaternion().setFromUnitVectors(from, to), t)
      playerDir = from.clone().applyQuaternion(q)
      placePlayer(playerDir)
      focusOn(playerDir)
      if (t < 1) requestAnimationFrame(tick)
      else { i++; if (settings.moveMode === 'dice') chiptune.sfx('step'); next() }
    }
    tick()
  }
  next()
}

function flyTo (loc) {
  const to = latLonToDir(loc.lat, loc.lon)
  const n = Math.max(10, Math.round(playerDir.angleTo(to) * 30))
  animatePath(greatCirclePoints(playerDir, to, n), () => arrive(loc))
}

function arrive (loc) {
  transit.value = null
  waypointGroup.clear()
  game.travelTo(viewWorld.value.id, loc.id)
  chiptune.sfx('coin')
  game.flash(`Has llegado a ${loc.name}`)
}

function drawWaypoints () {
  waypointGroup.clear()
  if (!transit.value) return
  const w = viewWorld.value
  transit.value.points.forEach((d, i) => {
    if (i < transit.value.index) return
    const event = i % 3 === 2 && i !== transit.value.points.length - 1
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.05, 0.14), new THREE.MeshBasicMaterial({ color: event ? '#d6333a' : '#ffd23c' }))
    m.position.copy(d.clone().multiplyScalar(w.radius * 1.08 + 0.05))
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d)
    waypointGroup.add(m)
  })
}

async function rollAndMove (loc) {
  if (!transit.value || transit.value.to !== loc.id) {
    const to = latLonToDir(loc.lat, loc.lon)
    const count = Math.max(3, Math.round(THREE.MathUtils.radToDeg(playerDir.angleTo(to)) / 9))
    transit.value = { to: loc.id, points: greatCirclePoints(playerDir, to, count), index: 0 }
    drawWaypoints()
  }
  const value = await rollDie()
  const t = transit.value
  const start = t.index
  const end = Math.min(t.points.length, start + value)
  const dirs = t.points.slice(start, end)
  animatePath(dirs, () => {
    t.index = end
    drawWaypoints()
    if (end >= t.points.length) { arrive(loc); return }
    if ((end - 1) % 3 === 2) {
      game.progress.zeni += 10
      game.save()
      game.say([{ who: 'Evento', text: ENCOUNTERS[Math.floor(Math.random() * ENCOUNTERS.length)] }])
    }
  })
}

function rollDie () {
  return new Promise(resolve => {
    die.value = { value: 1, rolling: true }
    let n = 0
    const iv = setInterval(() => {
      die.value.value = 1 + Math.floor(Math.random() * 6)
      chiptune.sfx('step')
      if (++n > 10) {
        clearInterval(iv)
        die.value.rolling = false
        chiptune.sfx('dice')
        const v = die.value.value
        setTimeout(() => { die.value = null; resolve(v) }, 600)
      }
    }, 70)
  })
}

// --- Interacción: arrastrar para girar, tocar para seleccionar ---
let dragging = null
function onDown (e) {
  dragging = { x: e.clientX, y: e.clientY, moved: 0 }
}
function onMove (e) {
  if (!dragging) return
  const dx = e.clientX - dragging.x
  const dy = e.clientY - dragging.y
  dragging.moved += Math.abs(dx) + Math.abs(dy)
  dragging.x = e.clientX
  dragging.y = e.clientY
  if (dragging.moved > 6) {
    autoFollow = false
    const qx = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), dx * 0.008)
    const qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), dy * 0.008)
    world3.quaternion.premultiply(qx).premultiply(qy)
  }
}
function onUp (e) {
  if (dragging && dragging.moved <= 6) pick(e)
  dragging = null
}
const raycaster = new THREE.Raycaster()
function pick (e) {
  raycaster.setFromCamera(pointerNDC(e, r3.canvas), camera)
  const hits = raycaster.intersectObjects([planet, ...markers], true)
  const hit = hits.find(h => h.object.userData.loc)
  if (hit && hit.distance - hits[0].distance < 0.6) {
    selected.value = hit.object.userData.loc
    chiptune.sfx('talk')
  }
}

onMounted(() => {
  r3 = createRetroRenderer(stage.value, { pixelScale: settings.pixelScale })
  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200)
  camera.position.set(0, 0, 17)
  r3.onResize = fitCamera
  function fitCamera (w = stage.value.clientWidth, h = stage.value.clientHeight) {
    camera.aspect = w / h
    // distancia para que el planeta quepa también en horizontal (móvil en vertical)
    const r = viewWorld.value.radius * 1.25
    const vHalf = THREE.MathUtils.degToRad(camera.fov / 2)
    const hHalf = Math.atan(Math.tan(vHalf) * camera.aspect)
    camera.position.z = Math.max(r / Math.sin(vHalf), r / Math.sin(hHalf))
    camera.updateProjectionMatrix()
  }
  refit = fitCamera
  scene.add(new THREE.AmbientLight('#8890c0', 1.2))
  const sun = new THREE.DirectionalLight('#fff4d6', 2.2)
  sun.position.set(6, 8, 10)
  scene.add(sun, starfield())
  buildWorld()

  const c = r3.canvas
  c.addEventListener('pointerdown', onDown)
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)

  const t0 = performance.now()
  const loop = () => {
    const t = (performance.now() - t0) / 1000
    if (autoFollow) world3.quaternion.slerp(followQ, 0.08)
    else if (!dragging) world3.rotateY(0.0008)
    for (const m of markers) {
      m.userData.beacon.rotation.y = t * 2
      m.userData.beacon.position.y += Math.sin(t * 3) * 0.002
    }
    if (player?.children[1]) player.children[1].position.y = 0.15 + Math.sin(t * 4) * 0.03
    r3.renderer.render(scene, camera)
    raf = requestAnimationFrame(loop)
  }
  loop()
  chiptune.play(viewWorld.value.music)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  window.removeEventListener('pointermove', onMove)
  window.removeEventListener('pointerup', onUp)
  r3?.dispose()
})
</script>

<style scoped>
.globe-view { position: fixed; inset: 0; }
.stage { position: absolute; inset: 0; }
.hud-top {
  position: absolute; top: 0; left: 0; right: 0; display: flex; justify-content: space-between; gap: 8px;
  padding: calc(env(safe-area-inset-top) + 10px) 12px 0; pointer-events: none;
}
.hud-top > * { pointer-events: auto; }
.worlds { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; }
.stats { display: flex; gap: 10px; align-items: center; white-space: nowrap; font-size: 10px; }
.world-title {
  position: absolute; top: calc(env(safe-area-inset-top) + 52px); left: 0; right: 0; text-align: center;
  pointer-events: none; text-shadow: 2px 2px 0 #000;
}
.world-title b { display: block; font-size: 14px; color: var(--yellow); }
.world-title small { font-size: 8px; opacity: .85; }
.panel { position: absolute; left: 12px; right: 12px; bottom: 44px; max-width: 460px; margin: 0 auto; }
.panel-head { display: flex; justify-content: space-between; align-items: center; }
.panel h2 { font-size: 13px; color: var(--yellow); margin: 0; }
.panel p { font-size: 10px; line-height: 1.6; }
.missions { list-style: none; padding: 0; margin: 8px 0; font-size: 10px; line-height: 1.8; }
.actions { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.hud-bottom {
  position: absolute; left: 0; right: 0; bottom: 0; display: flex; justify-content: space-between;
  padding: 8px 12px calc(env(safe-area-inset-bottom) + 8px); font-size: 8px; pointer-events: none;
}
.die-overlay { position: absolute; inset: 0; display: grid; place-items: center; background: #0006; }
.die {
  width: 90px; height: 90px; display: grid; place-items: center; font-size: 40px; background: #fff; color: #111;
  border: 4px solid #111; box-shadow: 6px 6px 0 #000;
}
.die.rolling { animation: shake .12s infinite; }
@keyframes shake { 50% { transform: rotate(12deg) scale(1.05); } }
.slide-enter-active, .slide-leave-active { transition: transform .2s steps(4), opacity .2s; }
.slide-enter-from, .slide-leave-to { transform: translateY(30px); opacity: 0; }
</style>
