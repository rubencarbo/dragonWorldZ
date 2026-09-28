// PANTALLAS — las vistas del juego:
//   · GlobeView     → bola del mundo 3D, selección de lugar y viaje (libre / dados)
//   · LocationView  → lugar ampliado: tocar para caminar, NPCs, misiones
//   · SettingsView  → ajustes (modo de avance, pixelado, música, partida)
//   · CharacterEditor → galería y editor pixel-art de personajes (con vista 3D)
//   · AdminView     → editor de misiones DLC + editor de personajes
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import * as THREE from 'three'
import {
  createRetroRenderer, attachGestures, pointerNDC, latLonToDir, greatCirclePoints, starfield,
  buildDiorama, landmarkModel, heroModel, VISUAL_STYLES,
  characterModel, characterName, spriteToVoxels, kintonModel, propModel, treeModel, imageToGrid, extractSprite, chiptune,
  findPath, isLocationUnlocked, validateMission
} from './motor.js'
import { WORLDS, getWorld, getLocation, MAPS, TILES, TRACKS } from './mundos.js'
import { CHARACTERS, CHARACTER_GROUPS, PALETTE, buildSprite, SPEC_OPTIONS, EXTRA_LABELS, COLOR_LABELS, DEFAULTS } from './personajes.js'
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

      <div class="zoom-ctrl">
        <button class="btn small" aria-label="Acercar" @click="zoomBy(1.5)">＋</button>
        <button class="btn small" aria-label="Alejar" @click="zoomBy(1 / 1.5)">－</button>
        <button class="btn small" aria-label="Centrar en el personaje" @click="recenter">◎</button>
      </div>

      <footer class="hud-bottom">
        <span class="muted">Arrastra · Pellizca para acercar · Toca un lugar</span>
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

    let r3, scene, camera, world3, planet, player, raf, refit, detachGestures, diorama, standObj
    let markers = []
    let waypointGroup
    const followQ = new THREE.Quaternion()
    let autoFollow = true
    let playerDir = new THREE.Vector3(0, 1, 0)
    const style = VISUAL_STYLES[settings.visualStyle] ? settings.visualStyle : 'bricks'
    const R = () => viewWorld.value.radius
    const S = () => viewWorld.value.decoScale || 0.42

    const unlocked = loc => isLocationUnlocked(loc, game.progress.completed)
    const isHere = loc => game.progress.worldId === viewWorld.value.id && game.progress.locationId === loc.id && !transit.value
    const requiredTitle = loc => missions.byId(loc.requires)?.title || loc.requires

    function buildWorld () {
      if (world3) scene.remove(world3)
      if (standObj) scene.remove(standObj)
      const w = viewWorld.value
      diorama = buildDiorama(w, style)
      world3 = new THREE.Group()
      world3.add(diorama.planet)
      planet = diorama.sphere
      standObj = diorama.stand
      scene.add(standObj)
      stage.value.style.background = w.bg || w.sky
      markers = []
      for (const loc of w.locations) {
        const dir = latLonToDir(loc.lat, loc.lon)
        const holder = new THREE.Group()
        holder.position.copy(diorama.surface(dir))
        holder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)
        const model = landmarkModel(loc.landmark, style)
        const size = S() * (loc.landmark === 'kaiohouse' ? 2.1 : 1.25)
        model.scale.setScalar(size)
        holder.add(model)
        const locked = w.locked || !unlocked(loc)
        const beacon = new THREE.Mesh(new THREE.OctahedronGeometry(0.09 * size / 0.5),
          new THREE.MeshStandardMaterial({ color: locked ? '#8a8a96' : '#ffd23c', emissive: locked ? '#222' : '#a06a00', roughness: 0.3 }))
        beacon.position.y = (loc.landmark === 'tower' ? 3 : 1.35) * size
        holder.add(beacon)
        // zona táctil generosa para dedos
        const hitArea = new THREE.Mesh(new THREE.SphereGeometry(0.9 * size, 6, 4), new THREE.MeshBasicMaterial())
        hitArea.position.y = 0.5 * size
        hitArea.visible = false
        holder.add(hitArea)
        holder.userData = { loc, beacon, baseY: beacon.position.y }
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
        createPlayer()
        world3.add(player)
        placePlayer(playerDir)
        focusOn(playerDir, true)
      } else {
        player = null
        focusOn(latLonToDir(w.locations[0].lat, w.locations[0].lon), true)
      }
    }

    function createPlayer () {
      player = new THREE.Group()
      const hero = heroModel(game.spriteOf(), style)
      hero.scale.multiplyScalar(S() * 1.5)
      hero.position.y = S() * 0.3
      const cloud = kintonModel()
      cloud.scale.setScalar(S() * 1.6)
      player.add(cloud, hero)
    }

    function placePlayer (dir) {
      // flotando por encima del lugar (sin tapar la casa)
      player.position.copy(diorama.surface(dir, S() * 3.4))
      player.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize())
    }

    // Gira el mundo para que `dir` quede mirando a la cámara
    function focusOn (dir, instant = false) {
      // el lugar queda en la parte alta del planeta, de pie y visto de lado (como en la maqueta)
      const target = new THREE.Vector3(0, 0.62, 0.78).normalize()
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
        const m = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.05, 16), new THREE.MeshStandardMaterial({ color: event ? '#d6333a' : '#ffd23c' }))
        m.position.copy(diorama.surface(d, 0.03))
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

    // --- Interacción estilo Google Maps: arrastrar gira, pellizcar/rueda acerca ---
    let zoom = 1 // 1 = planeta entero en pantalla
    let maxDist = 17 // distancia de la cámara con zoom 1 (se recalcula al redimensionar)
    const MAX_ZOOM = 6
    // zoom máximo = vista regional: siempre se ven ~3 unidades de ancho (varios lugares)
    let hHalfFov = 0.3
    const minDist = () => viewWorld.value.radius + Math.max(1.6, 1.25 / Math.tan(hHalfFov))
    const targetDist = () => Math.max(minDist(), maxDist / zoom)
    let dragging = false
    let dragTimer

    function setZoom (z) {
      // sin pasarse del límite real (si no, al alejar habría "pasos muertos")
      zoom = THREE.MathUtils.clamp(z, 1, Math.max(1, Math.min(MAX_ZOOM, maxDist / minDist())))
      if (zoom > 1.05) autoFollow = false
    }
    function zoomBy (f) { setZoom(zoom * f) }
    function recenter () {
      setZoom(1)
      if (player?.visible) focusOn(playerDir)
    }
    function onDrag (dx, dy) {
      autoFollow = false
      dragging = true
      clearTimeout(dragTimer)
      dragTimer = setTimeout(() => { dragging = false }, 1500)
      // cuanto más cerca, más lento gira (como al desplazar un mapa)
      const R = viewWorld.value.radius
      const k = 0.008 * THREE.MathUtils.clamp((camera.position.z - R) / (maxDist - R), 0.06, 1)
      const qx = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), dx * k)
      const qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), dy * k)
      world3.quaternion.premultiply(qx).premultiply(qy)
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
      // la maqueta se ve a resolución nativa salvo en el estilo pixel-art
      r3 = createRetroRenderer(stage.value, { pixelSize: style === 'pixel' ? Math.max(2.5, settings.pixelSize) : settings.pixelSize, alpha: true })
      scene = new THREE.Scene()
      camera = new THREE.PerspectiveCamera(36, 1, 0.05, 300)
      camera.position.set(0, 0, 17)
      r3.onResize = fitCamera
      function fitCamera (w = stage.value.clientWidth, h = stage.value.clientHeight) {
        camera.aspect = w / h
        // encuadre: planeta + peana (de +1,05R a -1,8R), también en vertical en el móvil
        const vHalf = THREE.MathUtils.degToRad(camera.fov / 2)
        const hHalf = Math.atan(Math.tan(vHalf) * camera.aspect)
        hHalfFov = Math.min(hHalf, vHalf)
        maxDist = Math.max((R() * 1.5) / Math.tan(vHalf), (R() * 1.12) / Math.tan(hHalf)) + R()
        camera.position.z = targetDist()
        camera.updateProjectionMatrix()
      }
      refit = () => { zoom = 1; fitCamera() }
      scene.add(new THREE.HemisphereLight('#ffffff', '#6a4ab0', style === 'toon' ? 1.6 : 1.1))
      const sun = new THREE.DirectionalLight('#fff6e6', style === 'toon' ? 1.6 : 2.4)
      sun.position.set(-6, 10, 9)
      const fill = new THREE.DirectionalLight('#c8d8ff', 0.8)
      fill.position.set(8, 2, 6)
      scene.add(sun, fill)
      if (style === 'pixel') scene.add(starfield())
      buildWorld()

      detachGestures = attachGestures(r3.canvas, { onTap: pick, onDrag, onZoom: zoomBy })

      const t0 = performance.now()
      const loop = () => {
        const t = (performance.now() - t0) / 1000
        if (autoFollow) world3.quaternion.slerp(followQ, 0.08)
        else if (!dragging && zoom < 1.05) world3.rotateY(0.0008)
        camera.position.z += (targetDist() - camera.position.z) * 0.15
        // con el planeta entero se centra la maqueta (peana incluida); al acercarse,
        // la vista sube hacia la zona alta, donde están el lugar actual y el personaje
        const k = THREE.MathUtils.clamp((camera.position.z - minDist()) / Math.max(0.01, maxDist - minDist()), 0, 1)
        const lookY = THREE.MathUtils.lerp(R() * 0.5, -R() * 0.38, k)
        camera.position.y = lookY
        camera.lookAt(0, lookY, 0)
        for (const m of markers) {
          m.userData.beacon.rotation.y = t * 2
          m.userData.beacon.position.y = m.userData.baseY + Math.sin(t * 3) * 0.05
        }
        if (player?.children[1]) player.children[1].position.y = S() * 0.3 + Math.sin(t * 4) * S() * 0.06
        r3.renderer.render(scene, camera)
        raf = requestAnimationFrame(loop)
      }
      loop()
      chiptune.play(viewWorld.value.music)
    })

    onBeforeUnmount(() => {
      cancelAnimationFrame(raf)
      detachGestures?.()
      r3?.dispose()
    })
    return { zoomBy, recenter, stage, WORLDS, viewWorld, switchWorld, game, balls, selected, unlocked, requiredTitle, isHere, enter, settings, traveling, flyTo, rollAndMove, transit, die }
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
            @click="switchCharacter(c)">{{ characterName(c) }}</button>
        </div>
        <button v-if="game.canTransform()" class="btn primary small transform" @click="transform">⚡ Transformarse</button>
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
        if (prop.kind === 'npc') obj.rotation.y = Math.PI / 4 // de cara a la cámara
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
        arrow.position.set(p.x, 1.9, p.z)
      }
    }

    function makePlayer () {
      if (player) scene.remove(player)
      player = characterModel(game.spriteOf(), 0.078)
      player.rotation.y = FACE_CAMERA
      player.castShadow = true
      const p = worldPos(...pos)
      player.position.set(p.x, tileAt(...pos).h - 0.3, p.z)
      scene.add(player)
    }

    function transform () {
      game.transform()
      makePlayer()
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

    // Los personajes siempre miran a la cámara (estilo "Paper Mario") para
    // lucir el sprite; solo se voltean a izquierda/derecha según el movimiento.
    const FACE_CAMERA = Math.PI / 4
    function face (x, y) {
      const a = worldPos(...pos)
      const b = worldPos(x, y)
      const screenX = (b.x - a.x) - (b.z - a.z) // proyección sobre el eje derecho de la pantalla
      if (Math.abs(screenX) > 0.01) player.scale.x = screenX > 0 ? 1 : -1
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
    // arrastrar desplaza la vista (vuelve al personaje cuando camina); pellizcar acerca
    const pan = new THREE.Vector3()
    let detachGestures
    function onDrag (dx, dy) {
      const k = 0.02 / camera.zoom
      // ejes de pantalla proyectados al suelo en la vista isométrica
      pan.x += (-dx - dy) * k * 0.7
      pan.z += (dx - dy) * k * 0.7
      pan.clampLength(0, Math.max(W, H) / 2)
    }
    function onZoom (f) {
      camera.zoom = THREE.MathUtils.clamp(camera.zoom * f, 0.6, 3)
      camera.updateProjectionMatrix()
    }
    function onTap (e) {
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
      r3 = createRetroRenderer(stage.value, { pixelSize: settings.pixelSize })
      scene = new THREE.Scene()
      scene.background = new THREE.Color(props.id === 'karin' ? '#8fc8ff' : '#79c7ff')
      const aspect = 1
      const zoom = 5.2
      camera = new THREE.OrthographicCamera(-zoom * aspect, zoom * aspect, zoom, -zoom, 0.1, 100)
      camera.zoom = 1.3 // un poco más cerca: los sprites de los personajes lucen más
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
      sun.shadow.mapSize.set(1024, 1024)
      Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12 })
      // luz de relleno desde la cámara: los sprites (de cara a ella) muestran sus colores reales
      const fill = new THREE.DirectionalLight('#ffffff', 1.1)
      fill.position.set(8, 6, 8)
      scene.add(sun, fill)

      buildTiles()
      syncProps()
      makePlayer()

      detachGestures = attachGestures(r3.canvas, { onTap, onDrag, onZoom })

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
        if (arrow?.visible) arrow.position.y = 1.85 + Math.sin(t * 4) * 0.12
        if (walkQueue.length) pan.multiplyScalar(0.9) // al caminar, la cámara vuelve al personaje
        camTarget.lerp(player.position.clone().add(pan), 0.1)
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
      detachGestures?.()
      r3?.dispose()
    })
    return { transform, characterName, stage, back, location, game, available, CHARACTERS, switchCharacter, settings, moves, rolling, roll }
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
        <label class="row">Estilo gráfico
          <select :value="settings.visualStyle" @change="settings.update({ visualStyle: $event.target.value })">
            <option v-for="(st, id) in VISUAL_STYLES" :key="id" :value="id">{{ st.name }}</option>
          </select>
        </label>
        <label class="row">Resolución
          <select :value="settings.pixelSize" @change="settings.update({ pixelSize: Number($event.target.value) })">
            <option :value="1">HD (nítido)</option>
            <option :value="1.5">Alta · retro sutil</option>
            <option :value="2">Media · retro suave</option>
            <option :value="3">Baja · 8 bits clásico</option>
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
        <a href="#/personajes" class="btn">🎨 Personajes</a>
        <a href="#/admin" class="btn">🛠 Panel Admin</a>
      </section>
    </div>`,
  setup () {
    function reset () {
      if (confirm('¿Seguro? Se perderá todo el progreso.')) game.reset()
    }
    return { settings, firebaseEnabled, reset, VISUAL_STYLES }
  }
}


// ============================================================ EDITOR DE PERSONAJES
// Galería de personajes + editor pixel-art con vista previa 3D en vóxeles.
// Los cambios se guardan como sprites personalizados (localStorage/Firestore)
// y el juego los usa al momento. "Copiar código" genera el bloque para pegar
// en personajes.js y dejarlo como versión definitiva.
const EXTRA_KEYS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

function drawSprite (canvas, grid, palette, scale = 6) {
  if (!canvas) return
  const w = Math.max(...grid.map(r => r.length))
  canvas.width = w * scale
  canvas.height = grid.length * scale
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  grid.forEach((row, y) => [...row].forEach((ch, x) => {
    if (!palette[ch]) return
    ctx.fillStyle = palette[ch]
    ctx.fillRect(x * scale, y * scale, scale, scale)
  }))
}

export const CharacterEditor = {
  template: `
    <div class="char-editor">
      <section class="card gallery">
        <div v-for="g in groups" :key="g.name" class="group">
          <h3>{{ g.name }}</h3>
          <div class="cards">
            <button v-for="id in g.ids" :key="id" class="char-card" :class="{ on: id === selId }" @click="select(id)">
              <canvas :ref="el => { if (el) thumbs[id] = el }" class="pix" />
              <span>{{ displayName(id) }}</span>
              <em v-if="sprites.custom[id]">editado</em>
            </button>
          </div>
        </div>
      </section>

      <section class="card editor-body">
        <div class="editor-top">
          <label class="name">Nombre <input v-model="work.name" @input="dirty = true" /></label>
          <small class="muted">{{ work.grid[0]?.length }}×{{ work.grid.length }} px</small>
        </div>

        <div class="workspace">
          <div class="canvas-wrap">
            <canvas ref="board" class="board" @pointerdown="onDown" @pointermove="onMove" @pointerup="onUp" @pointerleave="onUp" />
          </div>
          <div class="side">
            <div ref="preview" class="preview3d" />
            <small class="muted">Vista 3D (así se ve en el juego)</small>
          </div>
        </div>

        <details v-if="work.spec" class="design" open>
          <summary>🧩 Diseño por piezas <small class="muted">(regenera el sprite; los retoques de píxel se pierden)</small></summary>
          <div class="design-grid">
            <label v-for="f in DESIGN_FIELDS" :key="f.key">{{ f.label }}
              <select :value="work.spec[f.key] || f.def" @change="setSpec(f.key, $event.target.value)">
                <option v-for="o in SPEC_OPTIONS[f.key]" :key="o" :value="o">{{ o }}</option>
              </select>
            </label>
          </div>
          <div class="extras">
            <label v-for="x in SPEC_OPTIONS.extras" :key="x" class="chk">
              <input type="checkbox" :checked="!!work.spec[x]" @change="setSpec(x, $event.target.checked)" /> {{ EXTRA_LABELS[x] }}
            </label>
          </div>
          <div class="colors">
            <label v-for="k in SPEC_OPTIONS.colors" :key="k" class="col">
              <input type="color" :value="(work.spec.colors || {})[k] || DEFAULTS[k]" @input="setColor(k, $event.target.value)" />
              {{ COLOR_LABELS[k] || k }}
            </label>
          </div>
        </details>

        <div class="tools">
          <button v-for="t in TOOLS" :key="t.id" class="btn small" :class="{ primary: tool === t.id }" @click="tool = t.id">{{ t.label }}</button>
          <button class="btn small" :disabled="!history.length" @click="undo">↶ Deshacer</button>
        </div>

        <div class="palette">
          <button v-for="(hex, key) in work.palette" :key="key" class="swatch" :class="{ on: color === key }"
            :style="{ background: hex }" :title="hex" @click="color = key; if (tool === 'erase' || tool === 'pick') tool = 'paint'" />
          <button class="swatch add" title="Añadir color" @click="addColor">＋</button>
        </div>
        <label class="recolor">Color seleccionado
          <input type="color" :value="work.palette[color]" @input="recolor($event.target.value)" />
          <small class="muted">Cambiarlo recolorea todos sus píxeles (ideal para cambiar el color del traje)</small>
        </label>

        <div class="tools">
          <button class="btn small" :disabled="work.grid.length >= 64" @click="double">⤢ Más detalle (×2)</button>
          <label class="btn small file">🖼 Importar imagen<input type="file" accept="image/*" @change="loadImage" /></label>
          <label v-if="img" class="chk"><input v-model="imgPixelArt" type="checkbox" @change="applyImage" /> Es pixel-art (detectar rejilla y quitar fondo)</label>
          <label v-if="img && !imgPixelArt" class="imgopt">Altura {{ imgSize }}px
            <input v-model.number="imgSize" type="range" min="12" max="48" @input="applyImage" />
          </label>
          <label v-if="img" class="imgopt">Colores {{ imgColors }}
            <input v-model.number="imgColors" type="range" min="4" max="32" @input="applyImage" />
          </label>
        </div>

        <div class="tools">
          <button class="btn primary" :disabled="!dirty" @click="save">💾 Guardar</button>
          <button class="btn" :disabled="!dirty" @click="select(selId)">Descartar</button>
          <button v-if="sprites.custom[selId]" class="btn danger" @click="restore">↺ Original</button>
          <button class="btn" @click="copyCode">📋 Copiar código</button>
        </div>
        <p v-if="msg" class="ok">{{ msg }}</p>
        <textarea v-if="code" class="code" readonly :value="code" />
      </section>
    </div>`,
  setup () {
    const TOOLS = [
      { id: 'paint', label: '✏️ Pintar' },
      { id: 'erase', label: '🧽 Borrar' },
      { id: 'fill', label: '🪣 Rellenar' },
      { id: 'pick', label: '💧 Cuentagotas' }
    ]
    const groups = CHARACTER_GROUPS
    const selId = ref('goku')
    const work = ref({ name: '', grid: [[]], palette: {} })
    const tool = ref('paint')
    const color = ref('o')
    const history = ref([])
    const dirty = ref(false)
    const msg = ref('')
    const code = ref('')
    const board = ref(null)
    const preview = ref(null)
    const thumbs = {}
    const img = ref(null)
    const imgSize = ref(24)
    const imgColors = ref(20)
    const imgPixelArt = ref(true)

    const DESIGN_FIELDS = [
      { key: 'build', label: 'Complexión', def: 'kid' },
      { key: 'head', label: 'Cabeza', def: 'human' },
      { key: 'hair', label: 'Peinado', def: 'bald' },
      { key: 'face', label: 'Cara', def: 'happy' },
      { key: 'outfit', label: 'Ropa', def: 'gi' },
      { key: 'sleeves', label: 'Mangas', def: 'short' }
    ]
    let pixelEdited = false
    const source = id => sprites.custom[id] || { ...CHARACTERS[id], palette: CHARACTERS[id].palette || PALETTE }
    const displayName = id => characterName(id)
    const gridStrings = () => work.value.grid.map(r => r.join(''))

    function select (id) {
      const s = source(id)
      selId.value = id
      // solo los colores que usa el sprite + la paleta base para poder pintar
      work.value = {
        name: s.name || CHARACTERS[id]?.name || id,
        grid: s.grid.map(r => [...r.padEnd(Math.max(...s.grid.map(x => x.length)), '.')]),
        palette: { ...(s.palette || PALETTE) },
        spec: s.spec ? JSON.parse(JSON.stringify(s.spec)) : null
      }
      pixelEdited = Boolean(s.pixelEdited)
      color.value = Object.keys(work.value.palette)[0]
      history.value = []
      dirty.value = false
      code.value = ''
      msg.value = ''
      img.value = null
      redraw()
    }

    // ---------- lienzo ----------
    let cell = 16
    function redraw () {
      nextTick(() => {
        const c = board.value
        if (!c) return
        const g = work.value.grid
        const cols = g[0].length
        const maxW = Math.min(c.parentElement.clientWidth || 320, 420)
        cell = Math.max(4, Math.floor(maxW / cols))
        c.width = cols * cell
        c.height = g.length * cell
        const ctx = c.getContext('2d')
        g.forEach((row, y) => row.forEach((ch, x) => {
          const hex = work.value.palette[ch]
          ctx.fillStyle = hex || (((x + y) % 2) ? '#2a2a3a' : '#33334a')
          ctx.fillRect(x * cell, y * cell, cell, cell)
        }))
        if (cell >= 8) {
          ctx.strokeStyle = '#ffffff14'
          for (let x = 0; x <= cols; x++) { ctx.beginPath(); ctx.moveTo(x * cell + 0.5, 0); ctx.lineTo(x * cell + 0.5, c.height); ctx.stroke() }
          for (let y = 0; y <= g.length; y++) { ctx.beginPath(); ctx.moveTo(0, y * cell + 0.5); ctx.lineTo(c.width, y * cell + 0.5); ctx.stroke() }
        }
        schedulePreview()
      })
    }
    function snapshot () {
      history.value.push(JSON.stringify(work.value))
      if (history.value.length > 50) history.value.shift()
    }
    function undo () {
      const prev = history.value.pop()
      if (!prev) return
      work.value = JSON.parse(prev)
      dirty.value = true
      redraw()
    }
    function cellAt (e) {
      const r = board.value.getBoundingClientRect()
      const x = Math.floor((e.clientX - r.left) / r.width * work.value.grid[0].length)
      const y = Math.floor((e.clientY - r.top) / r.height * work.value.grid.length)
      return work.value.grid[y]?.[x] !== undefined ? [x, y] : null
    }
    function fill (x, y) {
      const g = work.value.grid
      const from = g[y][x]
      if (from === color.value) return
      const stack = [[x, y]]
      while (stack.length) {
        const [cx, cy] = stack.pop()
        if (g[cy]?.[cx] !== from) continue
        g[cy][cx] = color.value
        stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1])
      }
    }
    function apply (p) {
      const [x, y] = p
      const g = work.value.grid
      if (tool.value === 'pick') {
        if (g[y][x] !== '.') { color.value = g[y][x]; tool.value = 'paint' }
        return
      }
      if (tool.value === 'fill') fill(x, y)
      else g[y][x] = tool.value === 'erase' ? '.' : color.value
      pixelEdited = true
      dirty.value = true
      redraw()
    }
    let painting = false
    function onDown (e) {
      const p = cellAt(e)
      if (!p) return
      if (tool.value !== 'pick') snapshot()
      painting = tool.value === 'paint' || tool.value === 'erase'
      try { board.value.setPointerCapture(e.pointerId) } catch {}
      apply(p)
    }
    function onMove (e) {
      if (!painting) return
      const p = cellAt(e)
      if (p) apply(p)
    }
    function onUp () { painting = false }

    // ---------- diseño por piezas ----------
    let regenTimer
    function regenerate () {
      clearTimeout(regenTimer)
      regenTimer = setTimeout(() => {
        const r = buildSprite(work.value.spec)
        work.value.grid = r.grid.map(row => [...row])
        work.value.palette = r.palette
        color.value = Object.keys(r.palette)[0]
        pixelEdited = false
        dirty.value = true
        redraw()
      }, 60)
    }
    function setSpec (key, value) {
      snapshot()
      work.value.spec[key] = value
      regenerate()
    }
    function setColor (key, hex) {
      work.value.spec.colors = { ...(work.value.spec.colors || {}), [key]: hex }
      regenerate()
    }

    // ---------- colores ----------
    function recolor (hex) {
      work.value.palette[color.value] = hex
      pixelEdited = true
      dirty.value = true
      redraw()
    }
    function addColor () {
      const key = [...EXTRA_KEYS, ...'abcdefghijklmnopqrstuvwxyz'].find(k => !work.value.palette[k])
      if (!key) return
      work.value.palette[key] = '#ffffff'
      color.value = key
      tool.value = 'paint'
    }

    // ---------- resolución e imagen ----------
    function double () {
      snapshot()
      work.value.grid = work.value.grid.flatMap(row => {
        const r = row.flatMap(ch => [ch, ch])
        return [r, [...r]]
      })
      pixelEdited = true
      dirty.value = true
      redraw()
    }
    function loadImage (e) {
      const file = e.target.files[0]
      if (!file) return
      const im = new Image()
      im.onload = () => { img.value = im; applyImage() }
      im.src = URL.createObjectURL(file)
    }
    function applyImage () {
      if (!img.value) return
      if (!dirty.value || !history.value.length) snapshot()
      const r = imgPixelArt.value
        ? extractSprite(img.value, { maxColors: imgColors.value })
        : imageToGrid(img.value, { size: imgSize.value, maxColors: imgColors.value })
      work.value.grid = r.grid.map(row => [...row])
      work.value.palette = r.palette
      color.value = Object.keys(r.palette)[0]
      pixelEdited = true
      dirty.value = true
      redraw()
    }

    // ---------- guardar / exportar ----------
    async function save () {
      const { name, palette } = work.value
      const grid = gridStrings()
      // solo guardamos los colores que se usan
      const used = new Set(grid.join(''))
      const pal = Object.fromEntries(Object.entries(palette).filter(([k]) => used.has(k)))
      const spec = work.value.spec ? { ...work.value.spec, name } : null
      await sprites.save(selId.value, { name, grid, palette: pal, spec, pixelEdited, ref: CHARACTERS[selId.value]?.ref })
      dirty.value = false
      msg.value = '✔ Guardado. El juego ya usa esta versión.'
      drawThumbs()
    }
    async function restore () {
      if (!confirm('¿Volver al sprite original?')) return
      await sprites.remove(selId.value)
      select(selId.value)
      drawThumbs()
    }
    function copyCode () {
      // diseño sin retoques → basta con la spec (para CHARACTER_SPECS en personajes.js)
      if (work.value.spec && !pixelEdited) {
        const spec = { ...work.value.spec, name: work.value.name }
        code.value = `  ${selId.value}: ${JSON.stringify(spec, null, 2).replace(/"([a-zA-Z_]+)":/g, '$1:').replace(/"/g, "'").replace(/\n/g, '\n  ')},`
        navigator.clipboard?.writeText(code.value).then(() => { msg.value = '📋 Copiado: pégalo en CHARACTER_SPECS (personajes.js)' }).catch(() => {})
        return
      }
      const grid = gridStrings()
      const used = new Set(grid.join(''))
      const pal = Object.entries(work.value.palette).filter(([k]) => used.has(k))
      code.value = `  ${selId.value}: {\n    name: ${JSON.stringify(work.value.name)},\n` +
        `    palette: { ${pal.map(([k, v]) => `${/^[a-z]$/i.test(k) ? k : `'${k}'`}: '${v}'`).join(', ')} },\n` +
        `    grid: [\n${grid.map(r => `      '${r}'`).join(',\n')}\n    ]\n  },`
      navigator.clipboard?.writeText(code.value).then(() => { msg.value = '📋 Copiado: pégalo en personajes.js' }).catch(() => {})
    }

    function drawThumbs () {
      nextTick(() => {
        for (const g of groups) {
          for (const id of g.ids) {
            const s = source(id)
            drawSprite(thumbs[id], s.grid, s.palette || PALETTE, Math.max(2, Math.round(64 / s.grid.length)))
          }
        }
      })
    }

    // ---------- vista previa 3D ----------
    let r3, scene, camera, model, raf, pvTimer
    function schedulePreview () {
      clearTimeout(pvTimer)
      pvTimer = setTimeout(buildPreview, 120)
    }
    function buildPreview () {
      if (!scene) return
      if (model) scene.remove(model)
      const rows = work.value.grid.length
      model = spriteToVoxels(gridStrings(), work.value.palette, { size: 1.6 / rows, depth: Math.max(1.5, rows / 18) })
      scene.add(model)
    }
    onMounted(() => {
      select(selId.value)
      drawThumbs()
      r3 = createRetroRenderer(preview.value, { pixelSize: 1 })
      scene = new THREE.Scene()
      scene.background = new THREE.Color('#1c1c44')
      camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50)
      camera.position.set(0, 1.1, 3.4)
      camera.lookAt(0, 0.8, 0)
      r3.onResize = (w, h) => { camera.aspect = w / h; camera.updateProjectionMatrix() }
      scene.add(new THREE.HemisphereLight('#ffffff', '#445', 2))
      const sun = new THREE.DirectionalLight('#fff4d6', 1.5)
      sun.position.set(2, 3, 4)
      scene.add(sun)
      const floor = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.05, 24), new THREE.MeshLambertMaterial({ color: '#5cb85c' }))
      floor.position.y = -0.025
      scene.add(floor)
      buildPreview()
      const loop = () => {
        if (model) model.rotation.y += 0.015
        r3.renderer.render(scene, camera)
        raf = requestAnimationFrame(loop)
      }
      loop()
    })
    onBeforeUnmount(() => { cancelAnimationFrame(raf); r3?.dispose() })

    return {
      DESIGN_FIELDS, SPEC_OPTIONS, EXTRA_LABELS, COLOR_LABELS, DEFAULTS, setSpec, setColor,
      TOOLS, groups, selId, work, tool, color, history, dirty, msg, code, board, preview, thumbs, img, imgSize, imgColors, imgPixelArt,
      sprites, displayName, select, undo, onDown, onMove, onUp, recolor, addColor, double, loadImage, applyImage,
      save, restore, copyCode
    }
  }
}


// ============================================================ ADMIN
export const AdminView = {
  components: { CharacterEditor },
  props: { initialTab: { type: String, default: 'missions' } },
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
        <button class="chip" :class="{ on: tab === 'chars' }" @click="tab = 'chars'">🎨 Personajes</button>
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

      <!-- ===================== PERSONAJES ===================== -->
      <CharacterEditor v-else />
    </div>`,
  setup (props) {
    const tab = ref(props.initialTab)

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

    onMounted(() => { if (missions.all[0]) edit(missions.all[0]) })
    return { firebaseEnabled, user, login, tab, newMission, exportPack, importOpen, importText, importPack, byPack, editingId, edit, missions, isPublished, draft, validate, publish, remove, errors, okMsg, MAPS, helpMap, helpLoc, MINIGAMES, CHARACTERS, TRACKS }
  }
}
