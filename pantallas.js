// PANTALLAS — las vistas del juego:
//   · GlobeView     → bola del mundo 3D, selección de lugar y viaje (libre / dados)
//   · LocationView  → lugar ampliado: tocar para caminar, NPCs, misiones
//   · SettingsView  → ajustes (modo de avance, pixelado, música, partida)
//   · AdminView     → editor de misiones DLC y conversor de imágenes a sprites
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import * as THREE from 'three'
import {
  createRetroRenderer, pointerNDC, buildPlanet, surfacePoint, latLonToDir, greatCirclePoints, starfield,
  characterModel, kintonModel, propModel, treeModel, imageToGrid, chiptune,
  findPath, isLocationUnlocked, validateMission
} from './motor.js'
import { WORLDS, getWorld, getLocation, MAPS, TILES, TRACKS } from './mundos.js'
import { CHARACTERS, PALETTE } from './personajes.js'
import { MINIGAMES } from './minijuegos.js'
import { game, settings, missions, sprites, go, fb, firebaseEnabled } from './app.js'


// ============================================================ BOLA DEL MUNDO
export const GlobeView = {
  template: `
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
          <a href="#/ajustes" class="icon-btn" aria-label="Ajustes">⚙</a>
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
    </div>`,
  setup () {
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
      go(`/lugar/${loc.id}`)
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
    return { stage, WORLDS, viewWorld, switchWorld, game, balls, selected, unlocked, requiredTitle, isHere, enter, settings, traveling, flyTo, rollAndMove, transit, die }
  }
}


// ============================================================ LUGAR
export const LocationView = {
  props: { id: { type: String, required: true } },
  template: `
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
    </div>`,
  setup (props) {

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
      go('/')
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
        go('/')
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
    return { stage, back, location, game, available, CHARACTERS, switchCharacter, settings, moves, rolling, roll }
  }
}


// ============================================================ AJUSTES
export const SettingsView = {
  template: `
    <div class="page settings">
      <header class="page-head">
        <a href="#/" class="btn small">◀ Volver</a>
        <h1>Ajustes</h1>
      </header>

      <section class="card">
        <h2>Modo de avance</h2>
        <label class="opt">
          <input type="radio" value="free" :checked="settings.moveMode === 'free'" @change="settings.update({ moveMode: 'free' })" />
          <span><b>🕊 Avance libre</b><small>Toca donde quieras ir y el personaje camina (o vuela) hasta allí.</small></span>
        </label>
        <label class="opt">
          <input type="radio" value="dice" :checked="settings.moveMode === 'dice'" @change="settings.update({ moveMode: 'dice' })" />
          <span><b>🎲 Avance con dados</b><small>Tira el dado y avanza esas casillas, en el globo y dentro de cada lugar. Hay casillas-evento por el camino.</small></span>
        </label>
      </section>

      <section class="card">
        <h2>Imagen y sonido</h2>
        <label class="row">Píxeles (estilo 8 bits)
          <select :value="settings.pixelScale" @change="settings.update({ pixelScale: Number($event.target.value) })">
            <option :value="2">Fino</option>
            <option :value="3">Retro</option>
            <option :value="4">Muy retro</option>
          </select>
        </label>
        <label class="row">Música
          <input type="range" min="0" max="1" step="0.1" :value="settings.music" @input="settings.update({ music: Number($event.target.value) })" />
        </label>
      </section>

      <section class="card">
        <h2>Partida</h2>
        <p class="muted">Guardado {{ firebaseEnabled ? 'en la nube (Firebase)' : 'en este dispositivo' }}.</p>
        <button class="btn danger" @click="reset">Borrar progreso</button>
        <a href="#/admin" class="btn">🛠 Panel Admin</a>
      </section>
    </div>`,
  setup () {
    function reset () {
      if (confirm('¿Seguro? Se perderá todo el progreso.')) game.reset()
    }
    return { settings, firebaseEnabled, reset }
  }
}


// ============================================================ ADMIN
export const AdminView = {
  template: `
    <div class="page admin">
      <header class="page-head">
        <a href="#/" class="btn small">◀ Juego</a>
        <h1>Panel Admin</h1>
      </header>

      <p v-if="firebaseEnabled" class="muted">
        Modo Firebase: publicar requiere una cuenta con el claim <code>admin</code>.
        <template v-if="user">Sesión: {{ user.email || 'anónima' }}</template>
        <button v-if="!user || user.isAnonymous" class="btn small" @click="login">Entrar con Google</button>
      </p>
      <p v-else class="muted">Modo local: los cambios se guardan en este navegador (rellena <code>FIREBASE_CONFIG</code> en <code>app.js</code> para publicarlos a todos los jugadores).</p>

      <nav class="tabs">
        <button class="chip" :class="{ on: tab === 'missions' }" @click="tab = 'missions'">Misiones (DLC)</button>
        <button class="chip" :class="{ on: tab === 'sprites' }" @click="tab = 'sprites'">Sprites</button>
      </nav>

      <!-- ===================== MISIONES ===================== -->
      <section v-if="tab === 'missions'" class="grid">
        <aside class="card list">
          <div class="list-actions">
            <button class="btn small primary" @click="newMission">＋ Nueva</button>
            <button class="btn small" @click="exportPack">⬇ Exportar</button>
            <button class="btn small" @click="importOpen = !importOpen">⬆ Importar</button>
          </div>
          <div v-if="importOpen" class="import">
            <textarea v-model="importText" placeholder="Pega aquí un array JSON de misiones (pack DLC)" />
            <button class="btn small primary" @click="importPack">Importar pack</button>
          </div>
          <div v-for="(group, pack) in byPack" :key="pack" class="pack">
            <h3>📦 {{ pack }}</h3>
            <button v-for="m in group" :key="m.id" class="item" :class="{ on: m.id === editingId }" @click="edit(m)">
              <span>{{ m.title }}</span>
              <small>
                {{ m.locationId }}
                <em v-if="missions.isSeed(m.id) && !isPublished(m.id)">base</em>
                <em v-else-if="missions.isSeed(m.id)" class="mod">modificada</em>
                <em v-else class="dlc">DLC</em>
                <em v-if="m.enabled === false" class="off">off</em>
              </small>
            </button>
          </div>
        </aside>

        <div v-if="draft !== null" class="card editor">
          <div class="editor-head">
            <b>{{ editingId || 'Nueva misión' }}</b>
            <div class="list-actions">
              <button class="btn small" @click="validate">✔ Validar</button>
              <button class="btn small primary" @click="publish">🚀 Publicar</button>
              <button v-if="isPublished(editingId)" class="btn small danger" @click="remove">
                {{ missions.isSeed(editingId) ? '↺ Restaurar original' : '🗑 Eliminar' }}
              </button>
            </div>
          </div>
          <textarea v-model="draft" class="json" spellcheck="false" />
          <ul v-if="errors.length" class="errors"><li v-for="e in errors" :key="e">⚠ {{ e }}</li></ul>
          <p v-else-if="okMsg" class="ok">{{ okMsg }}</p>

          <details class="help" open>
            <summary>Referencia rápida</summary>
            <p><b>Lugares con mapa:</b> {{ Object.keys(MAPS).join(', ') }}</p>
            <p v-if="helpMap"><b>Props en «{{ helpLoc }}»:</b> {{ helpMap.props.map(p => p.id).join(', ') }}</p>
            <p><b>Minijuegos (step.game):</b> {{ Object.keys(MINIGAMES).join(', ') }}</p>
            <p><b>Pasos:</b> talk · goto · battle · collect. Usa <code>spawns</code> para añadir NPCs/objetos al mapa entre <code>fromStep</code> y <code>untilStep</code>.</p>
            <p><b>Sprites de NPC:</b> {{ Object.keys(CHARACTERS).join(', ') }} · <b>kinds:</b> npc, ball, cabin, altar, sign, kamehouse, palm, dome, crate, jar, pillar, footprints, bean</p>
            <p><b>Música:</b> {{ Object.keys(TRACKS).join(', ') }}</p>
          </details>
        </div>
      </section>

      <!-- ===================== SPRITES ===================== -->
      <section v-else class="card sprites">
        <p class="muted">Sube la imagen de un personaje (PNG con fondo transparente, idealmente de frente). Se reduce a pixel-art con paleta limitada y se extruye a vóxeles 3D en el juego.</p>
        <div class="row">
          <label>Personaje
            <select v-model="spriteId">
              <option v-for="(c, id) in CHARACTERS" :key="id" :value="id">{{ c.name }}</option>
            </select>
          </label>
          <label>Altura (px) {{ spriteSize }}
            <input v-model.number="spriteSize" type="range" min="12" max="40" @input="process" />
          </label>
          <label>Colores {{ spriteColors }}
            <input v-model.number="spriteColors" type="range" min="4" max="16" @input="process" />
          </label>
        </div>
        <input type="file" accept="image/*" @change="loadImage" />
        <div class="previews">
          <div>
            <small>Actual</small>
            <canvas ref="currentCanvas" class="pix" />
          </div>
          <div v-if="spriteResult">
            <small>Nuevo</small>
            <canvas ref="newCanvas" class="pix" />
          </div>
        </div>
        <div class="list-actions">
          <button class="btn primary" :disabled="!spriteResult" @click="saveSprite">Guardar sprite</button>
          <button v-if="sprites.custom[spriteId]" class="btn danger" @click="sprites.remove(spriteId).then(drawCurrent)">Volver al provisional</button>
        </div>
      </section>
    </div>`,
  setup () {
    const tab = ref('missions')

    // ---------- Auth (solo Firebase) ----------
    const user = ref(fb.auth?.currentUser || null)
    if (fb.auth) fb.au.onAuthStateChanged(fb.auth, u => { user.value = u })
    async function login () {
      await fb.au.signInWithPopup(fb.auth, new fb.au.GoogleAuthProvider())
    }

    // ---------- Misiones ----------
    const editingId = ref(null)
    const draft = ref(null)
    const errors = ref([])
    const okMsg = ref('')
    const importOpen = ref(false)
    const importText = ref('')

    const byPack = computed(() => {
      const g = {}
      for (const m of missions.all) (g[m.pack || 'sin pack'] ||= []).push(m)
      return g
    })
    const isPublished = id => missions.published.some(m => m.id === id)
    const parsed = computed(() => { try { return JSON.parse(draft.value) } catch { return null } })
    const helpLoc = computed(() => parsed.value?.locationId)
    const helpMap = computed(() => MAPS[helpLoc.value])

    const TEMPLATE = {
      id: 'dlc_nueva_mision',
      pack: 'dlc-1',
      enabled: true,
      worldId: 'tierra',
      locationId: 'paoz',
      requires: [],
      title: 'Nueva misión',
      summary: 'Descripción corta.',
      music: 'paoz',
      intro: [{ who: 'Narrador', text: 'Érase una vez...' }],
      spawns: [{ id: 'rival', kind: 'npc', sprite: 'oolong', x: 8, y: 6, name: 'Oolong', fromStep: 0 }],
      steps: [
        { type: 'talk', target: 'rival', hint: 'Habla con Oolong.', lines: [{ who: 'Oolong', text: '¡Te reto!' }] },
        { type: 'battle', target: 'rival', game: 'tictactoe', config: { level: 'easy' }, hint: 'Gana a Oolong.',
          lines: [{ who: 'Oolong', text: '¡Tres en raya!' }], win: [{ who: 'Oolong', text: 'Vaaale...' }], lose: [{ who: 'Oolong', text: '¡Ja!' }] }
      ],
      reward: { zeni: 50, items: [], characters: [] }
    }

    function edit (m) {
      editingId.value = m.id
      draft.value = JSON.stringify(m, null, 2)
      errors.value = []
      okMsg.value = ''
    }
    function newMission () {
      editingId.value = null
      draft.value = JSON.stringify(TEMPLATE, null, 2)
      errors.value = []
    }
    function check () {
      okMsg.value = ''
      if (!parsed.value) { errors.value = ['JSON no válido']; return false }
      errors.value = validateMission(parsed.value, { maps: MAPS, games: Object.keys(MINIGAMES) })
      return !errors.value.length
    }
    function validate () { if (check()) okMsg.value = '✔ Misión válida' }
    async function publish () {
      if (!check()) return
      try {
        await missions.publish(parsed.value)
        editingId.value = parsed.value.id
        okMsg.value = '🚀 Publicada. Los jugadores la verán al abrir el juego.'
      } catch (e) {
        errors.value = ['No se pudo publicar: ' + e.message]
      }
    }
    async function remove () {
      if (!confirm('¿Eliminar la versión publicada?')) return
      await missions.remove(editingId.value)
      const seed = missions.byId(editingId.value)
      if (seed) edit(seed)
      else { draft.value = null; editingId.value = null }
    }
    function exportPack () {
      const blob = new Blob([JSON.stringify(missions.published, null, 2)], { type: 'application/json' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = 'dragonworldz-missions.json'
      a.click()
    }
    async function importPack () {
      let list
      try { list = JSON.parse(importText.value) } catch { errors.value = ['JSON de importación no válido']; return }
      if (!Array.isArray(list)) list = [list]
      const bad = list.flatMap(m => validateMission(m, { maps: MAPS, games: Object.keys(MINIGAMES) }).map(e => `${m.id}: ${e}`))
      if (bad.length) { errors.value = bad; draft.value ??= ''; return }
      for (const m of list) await missions.publish(m)
      importText.value = ''
      importOpen.value = false
    }

    // ---------- Sprites ----------
    const spriteId = ref('goku')
    const spriteSize = ref(24)
    const spriteColors = ref(10)
    const spriteResult = ref(null)
    const currentCanvas = ref(null)
    const newCanvas = ref(null)
    let lastImage = null

    function drawGrid (canvas, grid, palette) {
      if (!canvas) return
      const scale = 6
      canvas.width = Math.max(...grid.map(r => r.length)) * scale
      canvas.height = grid.length * scale
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      grid.forEach((row, y) => [...row].forEach((ch, x) => {
        if (!palette[ch]) return
        ctx.fillStyle = palette[ch]
        ctx.fillRect(x * scale, y * scale, scale, scale)
      }))
    }
    function drawCurrent () {
      const c = sprites.custom[spriteId.value]
      if (c) drawGrid(currentCanvas.value, c.grid, c.palette)
      else drawGrid(currentCanvas.value, CHARACTERS[spriteId.value].grid, PALETTE)
    }
    function loadImage (e) {
      const file = e.target.files[0]
      if (!file) return
      const img = new Image()
      img.onload = () => { lastImage = img; process() }
      img.src = URL.createObjectURL(file)
    }
    async function process () {
      if (!lastImage) return
      spriteResult.value = imageToGrid(lastImage, { size: spriteSize.value, maxColors: spriteColors.value })
      await nextTick()
      drawGrid(newCanvas.value, spriteResult.value.grid, spriteResult.value.palette)
    }
    async function saveSprite () {
      await sprites.save(spriteId.value, spriteResult.value)
      drawCurrent()
    }
    watch(spriteId, () => nextTick(drawCurrent))
    watch(tab, t => { if (t === 'sprites') nextTick(drawCurrent) })

    onMounted(() => { if (missions.all[0]) edit(missions.all[0]) })
    return { firebaseEnabled, user, login, tab, newMission, exportPack, importOpen, importText, importPack, byPack, editingId, edit, missions, isPublished, draft, validate, publish, remove, errors, okMsg, MAPS, helpMap, helpLoc, MINIGAMES, CHARACTERS, TRACKS, spriteId, spriteSize, spriteColors, process, loadImage, spriteResult, currentCanvas, newCanvas, saveSprite, sprites, drawCurrent }
  }
}
