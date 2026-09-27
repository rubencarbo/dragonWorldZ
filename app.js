// APP — arranque del juego: configuración de Firebase, guardado de datos,
// estado global (ajustes, misiones, sprites, partida), navegación entre
// pantallas y componentes comunes (diálogos y combates).
import { createApp, reactive, computed, ref, watch, onMounted } from 'vue'
import { chiptune, registerCustomSprites, isMissionAvailable, resolveInteraction, visibleSpawns } from './motor.js'
import { SEED_MISSIONS, MAPS, getLocation } from './mundos.js'
import { CHARACTERS } from './personajes.js'
import { MINIGAMES } from './minijuegos.js'
import { GlobeView, LocationView, SettingsView, AdminView } from './pantallas.js'

// ============================================================ FIREBASE
// Rellena con la config de tu proyecto (consola de Firebase → Configuración
// del proyecto → Tus apps). Vacío = modo local (localStorage), sin red.
const FIREBASE_CONFIG = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: ''
}
const FIREBASE_CDN = 'https://www.gstatic.com/firebasejs/12.19.0'

export const firebaseEnabled = Boolean(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId)
export const fb = { app: null, db: null, auth: null, fs: null, au: null }

// Carga el SDK solo si hay configuración (así el modo local no descarga nada)
async function initFirebase () {
  if (!firebaseEnabled) return
  const [{ initializeApp }, fs, au] = await Promise.all([
    import(`${FIREBASE_CDN}/firebase-app.js`),
    import(`${FIREBASE_CDN}/firebase-firestore.js`),
    import(`${FIREBASE_CDN}/firebase-auth.js`)
  ])
  fb.app = initializeApp(FIREBASE_CONFIG)
  fb.db = fs.getFirestore(fb.app)
  fb.auth = au.getAuth(fb.app)
  fb.fs = fs
  fb.au = au
}

// Usuario actual (anónimo si hace falta) o null en modo local
function ensureUser () {
  if (!fb.auth) return Promise.resolve(null)
  return new Promise(resolve => {
    const off = fb.au.onAuthStateChanged(fb.auth, user => {
      off()
      if (user) resolve(user)
      else fb.au.signInAnonymously(fb.auth).then(c => resolve(c.user)).catch(() => resolve(null))
    })
  })
}

// ============================================================ DATOS (Firestore o localStorage)
// Colecciones: missions/{id} (DLC), sprites/{charId}, progress/{uid}
const LS = {
  get (k, def) {
    try { return JSON.parse(localStorage.getItem('dwz:' + k)) ?? def } catch { return def }
  },
  set (k, v) {
    try { localStorage.setItem('dwz:' + k, JSON.stringify(v)) } catch {}
  }
}

async function listCollection (name) {
  if (fb.db) {
    try {
      const snap = await fb.fs.getDocs(fb.fs.collection(fb.db, name))
      return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    } catch (e) {
      console.warn('[datos] Firestore no disponible, uso local:', e.message)
    }
  }
  return Object.values(LS.get(name, {}))
}
async function saveDoc (name, id, data) {
  if (fb.db) await fb.fs.setDoc(fb.fs.doc(fb.db, name, id), data)
  const all = LS.get(name, {})
  all[id] = { ...data, id }
  LS.set(name, all)
}
async function removeDoc (name, id) {
  if (fb.db) await fb.fs.deleteDoc(fb.fs.doc(fb.db, name, id))
  const all = LS.get(name, {})
  delete all[id]
  LS.set(name, all)
}

const progressRepo = {
  async load () {
    const local = LS.get('progress', null)
    const user = await ensureUser()
    if (user) {
      try {
        const snap = await fb.fs.getDoc(fb.fs.doc(fb.db, 'progress', user.uid))
        if (snap.exists()) return snap.data()
      } catch (e) { console.warn('[datos] progreso remoto no disponible:', e.message) }
    }
    return local
  },
  async save (data) {
    LS.set('progress', data)
    const user = await ensureUser()
    if (user) fb.fs.setDoc(fb.fs.doc(fb.db, 'progress', user.uid), data).catch(() => {})
  }
}

// ============================================================ AJUSTES
export const settings = reactive({
  moveMode: 'free', // 'free' | 'dice'
  pixelScale: 3,
  music: 0.5,
  ...LS.get('settings', {}),
  update (patch) {
    Object.assign(this, patch)
    chiptune.setVolume(this.music)
    const { update, ...data } = this
    LS.set('settings', data)
  }
})

// ============================================================ SPRITES PERSONALIZADOS
export const sprites = reactive({
  custom: {},
  async load () {
    for (const s of await listCollection('sprites')) this.custom[s.id] = s
  },
  async save (id, sprite) {
    await saveDoc('sprites', id, sprite)
    this.custom[id] = { ...sprite, id }
  },
  async remove (id) {
    await removeDoc('sprites', id)
    delete this.custom[id]
  }
})
registerCustomSprites(sprites.custom)

// ============================================================ MISIONES
// Semilla del juego + publicadas desde Admin (sobrescriben por id)
export const missions = reactive({
  published: [],
  get all () {
    const map = new Map(SEED_MISSIONS.map(m => [m.id, m]))
    for (const m of this.published) map.set(m.id, m)
    return [...map.values()]
  },
  byId (id) { return this.all.find(m => m.id === id) },
  isSeed (id) { return SEED_MISSIONS.some(m => m.id === id) },
  async load () { this.published = await listCollection('missions') },
  async publish (mission) {
    await saveDoc('missions', mission.id, mission)
    this.published = [...this.published.filter(m => m.id !== mission.id), mission]
  },
  async remove (id) {
    await removeDoc('missions', id)
    this.published = this.published.filter(m => m.id !== id)
  }
})

// ============================================================ PARTIDA
const ITEM_NAMES = { esfera_4: 'Esfera de 4 estrellas', radar: 'Radar del dragón', senzu: 'Semilla del ermitaño' }

const freshProgress = () => ({
  worldId: 'tierra',
  locationId: 'paoz',
  character: 'goku',
  team: ['goku'],
  completed: [],
  active: null, // { missionId, step }
  zeni: 0,
  inventory: []
})

export const game = reactive({
  progress: freshProgress(),
  dialog: null, // { lines, index, onDone }
  battle: null, // { step, enemy, missionId }
  toast: '',

  get activeMission () {
    const a = this.progress.active
    return a ? missions.byId(a.missionId) : null
  },
  get currentStep () {
    return this.activeMission?.steps[this.progress.active.step] || null
  },
  availableAt (locationId) {
    return missions.all.filter(m => m.locationId === locationId && isMissionAvailable(m, this.progress.completed))
  },
  spawnsAt (locationId) {
    const m = this.activeMission
    if (!m || m.locationId !== locationId) return []
    return visibleSpawns(m, this.progress.active.step)
  },
  itemName (id) { return ITEM_NAMES[id] || id },

  async load () {
    const saved = await progressRepo.load()
    if (saved) this.progress = { ...freshProgress(), ...saved }
  },
  save () {
    progressRepo.save(JSON.parse(JSON.stringify(this.progress)))
  },
  reset () {
    this.progress = freshProgress()
    this.save()
  },
  flash (msg) {
    this.toast = msg
    clearTimeout(this._t)
    this._t = setTimeout(() => { this.toast = '' }, 2200)
  },

  // --- diálogos ---
  say (lines, onDone) {
    if (!lines?.length) { onDone?.(); return }
    this.dialog = { lines, index: 0, onDone }
  },
  nextLine () {
    const d = this.dialog
    if (!d) return
    chiptune.sfx('talk')
    if (d.index < d.lines.length - 1) { d.index++; return }
    this.dialog = null
    d.onDone?.()
  },

  travelTo (worldId, locationId) {
    this.progress.worldId = worldId
    this.progress.locationId = locationId
    this.save()
  },

  // --- misiones ---
  startMission (id) {
    const m = missions.byId(id)
    if (!m) return
    if (m.locationId !== this.progress.locationId) {
      this.flash(`Esta misión empieza en ${getLocation(m.locationId)?.name || m.locationId}`)
      return
    }
    this.progress.active = { missionId: id, step: 0 }
    this.save()
    this.say(m.intro, () => this.flash(m.steps[0].hint || ''))
  },
  interact (prop) {
    const m = this.activeMission
    const res = resolveInteraction(m, this.progress.active?.step, prop.id)
    if (res.kind === 'flavor') {
      this.say(prop.lines || [{ who: prop.name, text: '...' }])
      return
    }
    const step = res.step
    if (res.kind === 'battle') {
      this.say(step.lines, () => {
        this.battle = { step, enemy: prop, missionId: m.id }
        chiptune.play('batalla')
      })
      return
    }
    this.say(step.lines, () => {
      if (res.kind === 'collect' && step.item) {
        this.progress.inventory.push(step.item)
        chiptune.sfx('coin')
        this.flash(`¡Conseguido: ${this.itemName(step.item)}!`)
      }
      this.advance()
    })
  },
  finishBattle (won, musicAfter) {
    const b = this.battle
    if (!b) return
    this.battle = null
    chiptune.play(musicAfter)
    this.say(won ? b.step.win : b.step.lose, () => { if (won) this.advance() })
  },
  advance () {
    const m = this.activeMission
    if (!m) return
    const next = this.progress.active.step + 1
    if (next < m.steps.length) {
      this.progress.active.step = next
      this.save()
      if (m.steps[next].hint) this.flash(m.steps[next].hint)
      return
    }
    this.completeMission(m)
  },
  completeMission (m) {
    const r = m.reward || {}
    this.progress.completed.push(m.id)
    this.progress.active = null
    this.progress.zeni += r.zeni || 0
    for (const it of r.items || []) this.progress.inventory.push(it)
    for (const c of r.characters || []) if (!this.progress.team.includes(c)) this.progress.team.push(c)
    this.save()
    chiptune.play('victoria')
    const lines = [{ who: '¡MISIÓN COMPLETADA!', text: `${m.title} · +${r.zeni || 0} zenis` }]
    if (r.characters?.length) lines.push({ who: 'Equipo', text: `Nuevo personaje disponible: ${r.characters.join(', ')}` })
    this.say(lines)
  }
})

// ============================================================ NAVEGACIÓN
// Rutas por hash: #/  ·  #/lugar/paoz  ·  #/ajustes  ·  #/admin
export const route = reactive({ name: 'globe', params: {}, path: '/' })

function parseHash () {
  const path = location.hash.replace(/^#/, '') || '/'
  const [, a, b] = path.split('/')
  route.path = path
  route.params = {}
  if (a === 'lugar' && b) { route.name = 'location'; route.params.id = b } else if (a === 'ajustes') route.name = 'settings'
  else if (a === 'admin') route.name = 'admin'
  else route.name = 'globe'
}
window.addEventListener('hashchange', parseHash)
parseHash()

export function go (path) { location.hash = path }

// ============================================================ DIÁLOGOS
const DialogBox = {
  template: `
    <div v-if="game.dialog" class="dialog-wrap" @click="onTap">
      <div class="dialog card">
        <b class="who">{{ line?.who }}</b>
        <p>{{ shown }}<span class="caret">▼</span></p>
      </div>
    </div>`,
  setup () {
    const line = computed(() => game.dialog?.lines[game.dialog.index])
    // efecto máquina de escribir; tocar completa el texto antes de avanzar
    const shown = ref('')
    let iv
    watch(line, l => {
      clearInterval(iv)
      if (!l) return
      shown.value = ''
      let i = 0
      iv = setInterval(() => {
        shown.value = l.text.slice(0, ++i)
        if (i >= l.text.length) clearInterval(iv)
      }, 22)
    }, { immediate: true })
    function onTap () {
      if (shown.value.length < line.value.text.length) {
        clearInterval(iv)
        shown.value = line.value.text
        return
      }
      game.nextLine()
    }
    return { game, line, shown, onTap }
  }
}

// ============================================================ COMBATES
const BattleHost = {
  template: `
    <div v-if="game.battle" class="overlay">
      <div class="battle card">
        <header>
          <span class="vs">{{ hero }} <b>VS</b> {{ game.battle.enemy.name }}</span>
          <small>{{ info?.name }}</small>
        </header>
        <p class="help">{{ info?.help }}</p>
        <component :is="info.component" v-if="info" :config="game.battle.step.config || {}" :enemy="game.battle.enemy" @end="end" />
        <p v-else>Minijuego desconocido: {{ game.battle.step.game }}</p>
        <button class="btn small flee" @click="end(false)">Huir</button>
      </div>
    </div>`,
  setup () {
    const info = computed(() => MINIGAMES[game.battle?.step.game])
    const hero = computed(() => CHARACTERS[game.progress.character]?.name || 'Goku')
    const end = won => game.finishBattle(won, MAPS[route.params.id]?.music || 'globo')
    return { game, info, hero, end }
  }
}

// ============================================================ APP
const App = {
  components: { GlobeView, LocationView, SettingsView, AdminView, DialogBox, BattleHost },
  template: `
    <div v-if="!started" class="title-screen" @click="start">
      <div class="logo">
        <span class="ball">★</span>
        <h1>DRAGON<br><b>WORLD Z</b></h1>
      </div>
      <p class="blink">{{ loading ? 'CARGANDO...' : 'TOCA PARA EMPEZAR' }}</p>
      <small>Fan game sin ánimo de lucro · prototipo</small>
    </div>
    <template v-else>
      <GlobeView v-if="route.name === 'globe'" :key="route.path" />
      <LocationView v-else-if="route.name === 'location'" :key="route.path" :id="route.params.id" />
      <SettingsView v-else-if="route.name === 'settings'" />
      <AdminView v-else-if="route.name === 'admin'" />
      <BattleHost />
      <DialogBox />
      <transition name="fade"><div v-if="game.toast" class="toast">{{ game.toast }}</div></transition>
    </template>`,
  setup () {
    const started = ref(false)
    const loading = ref(true)

    onMounted(async () => {
      await initFirebase()
      await Promise.all([game.load(), missions.load(), sprites.load()])
      loading.value = false
      // el panel admin no necesita pantalla de título
      if (route.name === 'admin') started.value = true
    })

    function start () {
      if (loading.value) return
      // el audio del navegador solo arranca tras un gesto del usuario
      chiptune.setVolume(settings.music)
      chiptune.resume()
      started.value = true
      if (!game.progress.completed.length && !game.progress.active && route.name === 'globe') {
        game.say([
          { who: 'Narrador', text: 'Hace mucho tiempo, siete esferas mágicas fueron repartidas por el mundo...' },
          { who: 'Narrador', text: 'Quien las reúna podrá invocar al dragón Shenlong y pedirle un deseo.' },
          { who: 'Goku', text: '¡Hola! Soy Goku. Gira el mundo con el dedo y toca la Montaña Paoz, ¡mi casa!' }
        ])
      }
    }
    return { started, loading, start, route, game }
  }
}

createApp(App).mount('#app')

// acceso de depuración desde la consola: __dwz.game, __dwz.go('/admin')...
window.__dwz = { game, settings, missions, sprites, route, go }
