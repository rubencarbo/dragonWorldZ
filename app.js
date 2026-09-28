// APP — arranque del juego: configuración de Firebase, guardado de datos,
// estado global (ajustes, misiones, sprites, partida), navegación entre
// pantallas y componentes comunes (diálogos y combates).
import { createApp, reactive, computed, ref, watch, onMounted, nextTick } from 'vue'
import { chiptune, characterName, spriteData, registerCustomSprites, isMissionAvailable, resolveInteraction, visibleSpawns } from './motor.js'
import { SEED_MISSIONS, MAPS, getLocation } from './mundos.js'
import { FORMS } from './personajes.js'
import { MINIGAMES } from './minijuegos.js'
import { GlobeView, LocationView, SettingsView, AdminView, LibroView, Portrait } from './pantallas.js'
import { i18n, t, tx, LANGS } from './idiomas.js'

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
  lang: (navigator.language || '').startsWith('ca') ? 'ca' : 'es', // es | ca
  comicFont: 'bangers', // tipo de letra de los bocadillos (ver COMIC_FONTS)
  textSize: 1, // escala del texto de los diálogos
  textSpeed: 28, // ms por letra (0 = instantáneo)
  soundChip: 'fm', // 'fm' = AdLib/Sound Blaster (PC 90s) · 'chip' = consola 8 bits
  ...LS.get('settings', {}),
  update (patch) {
    Object.assign(this, patch)
    applySettings()
  }
})

// tipos de letra de cómic para los diálogos (se cargan desde Google Fonts en index.html)
export const COMIC_FONTS = {
  bangers: { label: 'Bangers (cómic americano)', css: "'Bangers', 'Comic Neue', sans-serif", scale: 1.15 },
  comic: { label: 'Comic Neue (tebeo clásico)', css: "'Comic Neue', 'Comic Sans MS', sans-serif", scale: 1 },
  patrick: { label: 'Patrick Hand (rotulado a mano)', css: "'Patrick Hand', 'Comic Neue', sans-serif", scale: 1.1 },
  pixel: { label: 'Press Start 2P (8 bits)', css: "'Press Start 2P', monospace", scale: 0.62 }
}
function applySettings () {
  chiptune.setVolume(settings.music)
  chiptune.setMode(settings.soundChip)
  i18n.lang = settings.lang
  const root = document.documentElement
  root.lang = settings.lang
  const f = COMIC_FONTS[settings.comicFont] || COMIC_FONTS.bangers
  root.style.setProperty('--comic-font', f.css)
  root.style.setProperty('--comic-size', (16 * f.scale * settings.textSize).toFixed(1) + 'px')
  const { update, ...data } = settings
  LS.set('settings', data)
}
applySettings()

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
  inventory: [],
  story: {} // Modo Historia: { libro1: { done: [capítulos], at: { c1: página } } }
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
  itemName (id) { return t(ITEM_NAMES[id] || id) },
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
    this.flash(next === id ? t('Vuelves a tu forma normal') : `¡${characterName(next)}!`)
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
      this.flash(t('Esta misión empieza en {p}', { p: t(getLocation(m.locationId)?.name || m.locationId) }))
      return
    }
    this.progress.active = { missionId: id, step: 0 }
    this.save()
    this.say(m.intro, () => this.flash(tx(m.steps[0].hint || '')))
  },
  interact (prop) {
    const m = this.activeMission
    const res = resolveInteraction(m, this.progress.active?.step, prop.id)
    if (res.kind === 'flavor') {
      this.say(prop.lines?.map(l => ({ sprite: prop.sprite && prop.kind === 'npc' ? prop.sprite : undefined, ...l })) || [{ who: prop.name, text: '...' }])
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
        this.flash(t('¡Conseguido: {i}!', { i: this.itemName(step.item) }))
      }
      this.advance()
    })
  },
  finishBattle (won, musicAfter) {
    const b = this.battle
    if (!b) return
    this.battle = null
    chiptune.play(musicAfter)
    // combates del Modo Historia: el libro decide qué pasa después
    if (b.onEnd) { b.onEnd(won); return }
    this.say(won ? b.step.win : b.step.lose, () => { if (won) this.advance() })
  },
  advance () {
    const m = this.activeMission
    if (!m) return
    const next = this.progress.active.step + 1
    if (next < m.steps.length) {
      this.progress.active.step = next
      this.save()
      if (m.steps[next].hint) this.flash(tx(m.steps[next].hint))
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
    const lines = [{ who: '¡MISIÓN COMPLETADA!', sprite: null, kind: 'shout', text: t('{title} · +{z} zenis', { title: tx(m.title), z: r.zeni || 0 }) }]
    if (r.characters?.length) lines.push({ who: 'Equipo', sprite: null, text: t('Nuevo personaje disponible: {c}', { c: r.characters.map(characterName).join(', ') }) })
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
  else if (a === 'libro') { route.name = 'book'; route.params.chapter = b || null }
  else route.name = 'globe'
}
window.addEventListener('hashchange', parseHash)
parseHash()

export function go (path) { location.hash = path }

// ============================================================ DIÁLOGOS (bocadillos de cómic)
// Quién habla → sprite del retrato. Una línea puede traer `sprite` explícito.
const WHO_SPRITE = {
  Goku: 'goku', Gohan: 'gohan', 'Chichí': 'chichi', Krilin: 'krilin', Roshi: 'roshi', 'Maestro Roshi': 'roshi',
  Umigame: 'umigame', Raditz: 'raditz', Piccolo: 'piccolo', Bulma: 'bulma', Oolong: 'oolong', Karin: 'karin',
  Dinosaurio: 'dino', Yamcha: 'yamcha', Puar: 'puar', Vegeta: 'vegeta'
}
export function speakerSprite (line) {
  if (!line) return null
  if (line.sprite !== undefined) return line.sprite
  const id = WHO_SPRITE[line.who]
  // en los recuerdos (Goku niño...) el retrato es el del personaje que se juega
  const playAs = game.activeMission?.playAs
  if (id && playAs && playAs.startsWith(id)) return playAs
  if (id && id === game.progress.character) return game.spriteOf(id)
  return id && spriteData(id) ? id : null
}
// tipo de bocadillo según el texto: grito (MAYÚSCULAS), pensamiento/acción (entre paréntesis)
export function bubbleKind (line) {
  if (!line) return 'talk'
  if (line.kind) return line.kind
  if (!line.who || /^(Narrador|Narradora)$/.test(line.who)) return 'caption'
  const txt = line.text || ''
  if (/^\(.*\)$/.test(txt.trim())) return 'think'
  if (/[A-ZÁÉÍÓÚÑ]{4,}/.test(txt) && txt.includes('!')) return 'shout'
  return 'talk'
}

const DialogBox = {
  components: { Portrait },
  template: `
    <div v-if="game.dialog" class="dialog-wrap" @click="onTap">
      <div class="comic-line" :class="kind" :key="game.dialog.index + ':' + (line?.who || '')">
        <div v-if="kind === 'caption'" class="caption-box comic-text">
          <p>{{ shown }}<span class="caret">▶</span></p>
        </div>
        <template v-else>
          <Portrait v-if="sprite" :key="sprite" :id="sprite" bust class="speaker" />
          <div class="bubble comic-text" :class="kind">
            <b class="who">{{ who }}</b>
            <p>{{ shown }}<span class="caret">▶</span></p>
          </div>
        </template>
      </div>
    </div>`,
  setup () {
    const line = computed(() => game.dialog?.lines[game.dialog.index])
    const text = computed(() => tx(line.value?.text || ''))
    const who = computed(() => tx(line.value?.who || ''))
    const kind = computed(() => bubbleKind(line.value))
    const sprite = computed(() => speakerSprite(line.value))
    // efecto máquina de escribir; tocar completa el texto antes de avanzar
    const shown = ref('')
    let iv
    watch(text, l => {
      clearInterval(iv)
      shown.value = ''
      if (!l) return
      if (!settings.textSpeed) { shown.value = l; return }
      let i = 0
      iv = setInterval(() => {
        shown.value = l.slice(0, ++i)
        if (i >= l.length) clearInterval(iv)
      }, settings.textSpeed)
    }, { immediate: true })
    function onTap () {
      if (shown.value.length < text.value.length) {
        clearInterval(iv)
        shown.value = text.value
        return
      }
      game.nextLine()
    }
    return { game, line, shown, onTap, who, kind, sprite }
  }
}

// ============================================================ COMBATES
// Retrato pixel-art de un luchador (o un emoji si el rival no es un personaje)
const EMOJI_FOR = { turtle: '🐢', fishspot: '🐟', crate: '💊', jar: '🏺', ball: '🟠', bean: '🫘' }

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
            <b>{{ tx(game.battle.enemy.name) }}</b>
          </div>
          <div v-if="pop" :key="pop.k" class="pop" :class="pop.side">{{ pop.text }}</div>
        </div>
        <header>
          <span class="gname">{{ t(info?.name) }}</span>
          <small>{{ t(info?.help) }}</small>
        </header>
        <component :is="info.component" v-if="info" :config="game.battle.step.config || {}" :enemy="game.battle.enemy" @end="end" @hit="onHit" />
        <p v-else>{{ t('Minijuego desconocido: {g}', { g: game.battle.step.game }) }}</p>
        <button class="btn small flee" @click="end(false)">{{ t('Huir') }}</button>
      </div>
    </div>`,
  setup () {
    const info = computed(() => MINIGAMES[game.battle?.step.game])
    const heroSprite = computed(() => game.battle?.hero || game.spriteOf())
    const hero = computed(() => characterName(heroSprite.value))
    const enemySprite = computed(() => game.battle?.enemy.sprite)
    const enemyEmoji = computed(() => game.battle?.enemy.sprite ? null : (game.battle?.enemy.emoji || EMOJI_FOR[game.battle?.enemy.kind] || '❓'))
    const hurt = ref(null)
    const pop = ref(null)
    let hitTimer
    function onHit (who) {
      hurt.value = who
      pop.value = { k: Date.now(), side: who, text: t(who === 'enemy' ? ['¡PAM!', '¡ZAS!', '¡BIEN!', '¡BOOM!'][Math.floor(Math.random() * 4)] : '¡AUCH!') }
      clearTimeout(hitTimer)
      hitTimer = setTimeout(() => { hurt.value = null; pop.value = null }, 650)
    }
    const end = won => game.finishBattle(won, game.battle?.music || MAPS[route.params.id]?.music || 'globo')
    return { game, info, hero, heroSprite, enemySprite, enemyEmoji, hurt, pop, onHit, end }
  }
}

// ============================================================ APP
const App = {
  components: { GlobeView, LocationView, SettingsView, AdminView, LibroView, DialogBox, BattleHost },
  template: `
    <div v-if="!started" class="title-screen" @click="start" @pointerdown.once="titleMusic">
      <div class="logo">
        <span class="ball">★</span>
        <h1 v-if="settings.lang === 'ca'">BOLA<br><b>DE DRAC Z</b></h1>
        <h1 v-else>DRAGON<br><b>BALL Z</b></h1>
        <p class="subtitle">{{ t('Las bolas de dragón') }}</p>
      </div>
      <p v-if="loading" class="blink">{{ t('CARGANDO...') }}</p>
      <div v-else class="modes" @click.stop>
        <button class="btn primary big" @click="start('/libro')">📖 {{ t('Modo Historia') }}</button>
        <button class="btn big" @click="start('/')">🌍 {{ t('Mundo abierto') }}</button>
      </div>
      <div class="lang-pick" @click.stop>
        <button v-for="(name, code) in LANGS" :key="code" class="btn small" :class="{ primary: settings.lang === code }"
          @click="settings.update({ lang: code })">{{ name }}</button>
      </div>
      <small>{{ t('Fan game sin ánimo de lucro · prototipo') }}</small>
    </div>
    <template v-else>
      <GlobeView v-if="route.name === 'globe'" :key="route.path" />
      <LocationView v-else-if="route.name === 'location'" :key="route.path" :id="route.params.id" />
      <SettingsView v-else-if="route.name === 'settings'" />
      <LibroView v-else-if="route.name === 'book'" :key="route.path" :chapter-id="route.params.chapter" />
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

    function start (to) {
      if (loading.value) return
      if (typeof to === 'string') go(to)
      // el audio del navegador solo arranca tras un gesto del usuario
      chiptune.setVolume(settings.music)
      chiptune.resume()
      started.value = true
      if (!game.progress.completed.length && !game.progress.active && route.name === 'globe' && to !== '/libro') {
        game.say([
          { who: 'Narrador', text: 'Hace mucho tiempo, siete esferas mágicas fueron repartidas por el mundo...' },
          { who: 'Narrador', text: 'Quien las reúna podrá invocar al dragón Shenlong y pedirle un deseo.' },
          { who: 'Goku', text: '¡Hola! Soy Goku. Gira el mundo con el dedo y toca la Montaña Paoz, ¡mi casa!' }
        ])
      }
    }
    // el navegador solo deja sonar audio tras el primer toque: arranca el tema del título
    function titleMusic () {
      chiptune.setVolume(settings.music)
      chiptune.resume()
      chiptune.play('titulo')
    }
    return { started, loading, start, titleMusic, route, game, settings, LANGS }
  }
}

const app = createApp(App)
// t() y tx() disponibles en todas las plantillas
app.config.globalProperties.t = t
app.config.globalProperties.tx = tx
app.mount('#app')

// acceso de depuración desde la consola: __dwz.game, __dwz.go('/admin')...
window.__dwz = { game, settings, missions, sprites, route, go }
