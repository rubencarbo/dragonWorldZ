// APP — arranque del juego: configuración de Firebase, guardado de datos,
// estado global (ajustes, misiones, sprites, partida), navegación entre
// pantallas y componentes comunes (diálogos y combates).
import { createApp, reactive, computed, ref, watch, onMounted } from 'vue'
import { chiptune, characterName, spriteData, registerCustomSprites, isMissionAvailable, resolveInteraction, visibleSpawns } from './motor.js'
import { SEED_MISSIONS, MAPS, getLocation } from './mundos.js'
import { FORMS } from './personajes.js'
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
  pixelSize: 1, // píxeles de pantalla por píxel de juego (ver createRetroRenderer)
  visualStyle: 'bricks', // estilo gráfico del mundo: bricks | toon | pixel
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
const ITEM_NAMES = { esfera_4: 'Esfera de 4 estrellas', radar: 'Radar del dragón', senzu: 'Semilla del ermitaño', scouter: 'Scouter de Raditz' }

const freshProgress = () => ({
  worldId: 'tierra',
  locationId: 'paoz',
  character: 'goku',
  forms: {}, // forma actual de cada personaje (p. ej. { goku: 'goku_ssj' })
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
  // sprite que se dibuja para un personaje (según su transformación actual)
  spriteOf (id = this.progress.character) {
    // algunas misiones se juegan con otro personaje (p. ej. Goku niño en un recuerdo)
    const m = this.activeMission
    if (m?.playAs && id === this.progress.character) return m.playAs
    return this.progress.forms?.[id] || id
  },
  canTransform (id = this.progress.character) { return (FORMS[id] || []).length > 1 && !this.activeMission?.playAs },
  // siguiente misión disponible en otro lugar (para orientar al jugador)
  nextElsewhere (locationId) {
    const m = missions.all.find(m => m.locationId !== locationId && isMissionAvailable(m, this.progress.completed))
    return m ? { mission: m, location: getLocation(m.locationId) } : null
  },
  transform () {
    const id = this.progress.character
    const forms = FORMS[id]
    if (!forms) return
    const next = forms[(forms.indexOf(this.spriteOf(id)) + 1) % forms.length]
    this.progress.forms = { ...(this.progress.forms || {}), [id]: next }
    this.save()
    chiptune.sfx(next === id ? 'bad' : 'ok')
    this.flash(next === id ? 'Vuelves a tu forma normal' : `¡${characterName(next)}!`)
  },

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
// Rutas por hash: #/  ·  #/lugar/paoz  ·  #/ajustes  ·  #/personajes  ·  #/admin
export const route = reactive({ name: 'globe', params: {}, path: '/' })

function parseHash () {
  const path = location.hash.replace(/^#/, '') || '/'
  const [, a, b] = path.split('/')
  route.path = path
  route.params = {}
  if (a === 'lugar' && b) { route.name = 'location'; route.params.id = b } else if (a === 'ajustes') route.name = 'settings'
  else if (a === 'admin') route.name = 'admin'
  else if (a === 'personajes') route.name = 'characters'
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
// Retrato pixel-art de un luchador (o un emoji si el rival no es un personaje)
const EMOJI_FOR = { turtle: '🐢', fishspot: '🐟', crate: '💊', jar: '🏺', ball: '🟠', bean: '🫘' }
const Portrait = {
  props: { id: String, emoji: String, flip: Boolean },
  template: `<div class="portrait" :class="{ flip }"><canvas v-if="!emoji" ref="cv" /><span v-else class="emoji">{{ emoji }}</span></div>`,
  setup (props) {
    const cv = ref(null)
    onMounted(() => {
      const sp = spriteData(props.id)
      if (!cv.value || !sp) return
      const g = sp.grid
      const w = Math.max(...g.map(r => r.length))
      cv.value.width = w; cv.value.height = g.length
      const ctx = cv.value.getContext('2d')
      g.forEach((row, y) => [...row].forEach((ch, x) => {
        const c = sp.palette?.[ch]
        if (c) { ctx.fillStyle = c; ctx.fillRect(x, y, 1, 1) }
      }))
    })
    return { cv }
  }
}

const BattleHost = {
  components: { Portrait },
  template: `
    <div v-if="game.battle" class="overlay battle-overlay" :class="'theme-' + game.battle.step.game">
      <div class="battle">
        <div class="fighters">
          <div class="fighter hero" :class="{ hurt: hurt === 'hero', strike: hurt === 'enemy' }">
            <Portrait :id="heroSprite" />
            <b>{{ hero }}</b>
          </div>
          <div class="vs">VS</div>
          <div class="fighter enemy" :class="{ hurt: hurt === 'enemy', strike: hurt === 'hero' }">
            <Portrait :id="enemySprite" :emoji="enemyEmoji" flip />
            <b>{{ game.battle.enemy.name }}</b>
          </div>
          <div v-if="pop" :key="pop.k" class="pop" :class="pop.side">{{ pop.text }}</div>
        </div>
        <header>
          <span class="gname">{{ info?.name }}</span>
          <small>{{ info?.help }}</small>
        </header>
        <component :is="info.component" v-if="info" :config="game.battle.step.config || {}" :enemy="game.battle.enemy" @end="end" @hit="onHit" />
        <p v-else>Minijuego desconocido: {{ game.battle.step.game }}</p>
        <button class="btn small flee" @click="end(false)">Huir</button>
      </div>
    </div>`,
  setup () {
    const info = computed(() => MINIGAMES[game.battle?.step.game])
    const heroSprite = computed(() => game.spriteOf())
    const hero = computed(() => characterName(heroSprite.value))
    const enemySprite = computed(() => game.battle?.enemy.sprite)
    const enemyEmoji = computed(() => game.battle?.enemy.sprite ? null : (EMOJI_FOR[game.battle?.enemy.kind] || '❓'))
    const hurt = ref(null)
    const pop = ref(null)
    let t
    function onHit (who) {
      hurt.value = who
      pop.value = { k: Date.now(), side: who, text: who === 'enemy' ? ['¡PAM!', '¡ZAS!', '¡BIEN!', '¡BOOM!'][Math.floor(Math.random() * 4)] : '¡AUCH!' }
      clearTimeout(t)
      t = setTimeout(() => { hurt.value = null; pop.value = null }, 650)
    }
    const end = won => game.finishBattle(won, MAPS[route.params.id]?.music || 'globo')
    return { game, info, hero, heroSprite, enemySprite, enemyEmoji, hurt, pop, onHit, end }
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
      <AdminView v-else-if="route.name === 'admin' || route.name === 'characters'" :key="route.name"
        :initial-tab="route.name === 'characters' ? 'chars' : 'missions'" />
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
      if (route.name === 'admin' || route.name === 'characters') started.value = true
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
