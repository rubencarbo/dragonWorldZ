// MINIJUEGOS — combates basados en juegos infantiles.
// Cada minijuego es un componente Vue (props: config, enemy · emite 'end' con
// true/false y 'hit' con 'hero' | 'enemy' para animar la pantalla de combate)
// registrado en MINIGAMES. La lógica pura va arriba para testearla.
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { chiptune, noteToFreq } from './motor.js'
import { i18n, t, tx, RHYMES_CA, QUIZ_CA } from './idiomas.js'

// ============================================================ LÓGICA
// ---------- Piedra, papel o tijera ----------
const BEATS = { piedra: 'tijera', papel: 'piedra', tijera: 'papel' }
export function rpsWinner (a, b) {
  if (a === b) return 'draw'
  return BEATS[a] === b ? 'win' : 'lose'
}
// El rival intenta ganar a tu jugada más frecuente (con algo de azar)
export function rpsEnemyMove (history, rnd = Math.random) {
  const moves = Object.keys(BEATS)
  if (!history.length || rnd() < 0.35) return moves[Math.floor(rnd() * 3)]
  const count = {}
  for (const m of history) count[m] = (count[m] || 0) + 1
  const fav = Object.entries(count).sort((a, b) => b[1] - a[1])[0][0]
  return moves.find(m => BEATS[m] === fav)
}

// ---------- Tres en raya ----------
export const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]]
export function tttWinner (b) {
  for (const [a, c, d] of LINES) if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a]
  return b.every(Boolean) ? 'draw' : null
}
function minimax (b, me, turn) {
  const w = tttWinner(b)
  if (w === me) return { score: 1 }
  if (w === 'draw') return { score: 0 }
  if (w) return { score: -1 }
  let best = { score: turn === me ? -2 : 2 }
  b.forEach((v, i) => {
    if (v) return
    b[i] = turn
    const { score } = minimax(b, me, turn === 'X' ? 'O' : 'X')
    b[i] = null
    if (turn === me ? score > best.score : score < best.score) best = { score, move: i }
  })
  return best
}
// level: easy (60% azar) | normal (25% azar) | hard (perfecto)
export function tttAiMove (b, me = 'X', level = 'normal', rnd = Math.random) {
  const free = b.map((v, i) => v ? null : i).filter(i => i !== null)
  const chance = { easy: 0.6, normal: 0.25, hard: 0 }[level] ?? 0.25
  if (rnd() < chance) return free[Math.floor(rnd() * free.length)]
  return minimax([...b], me, me).move ?? free[0]
}

// ---------- Rimas ----------
export const RHYMES = [
  ['dragón', 'corazón'], ['esfera', 'primavera'], ['tortuga', 'lechuga'], ['nube', 'sube'],
  ['poder', 'amanecer'], ['cola', 'ola'], ['montaña', 'castaña'], ['guerrero', 'sombrero'],
  ['semilla', 'maravilla'], ['torre', 'corre'], ['revista', 'pista'], ['bola', 'caracola'],
  ['estrella', 'botella'], ['pelea', 'marea'], ['piedra', 'hiedra'], ['escudo', 'saludo'],
  ['cápsula', 'brújula'], ['entrenar', 'desayunar'], ['zenis', 'tenis'], ['isla', 'Priscila']
]
export function rhymeKey (w) {
  const s = w.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  // rima asonante/consonante simplificada: desde la última vocal tónica aprox. (3 últimas letras)
  return s.slice(-3)
}
export function makeRhymeRound (i, rnd = Math.random, list = RHYMES) {
  const [word, answer] = list[i % list.length]
  const key = rhymeKey(answer)
  const pool = list.map(r => r[1]).filter(w => rhymeKey(w) !== key)
  const opts = new Set([answer])
  while (opts.size < 4) opts.add(pool[Math.floor(rnd() * pool.length)])
  return { word, answer, options: [...opts].sort(() => rnd() - 0.5) }
}

// ---------- Trile (seguir la jarra) ----------
export function randomSwaps (n, count = 3, rnd = Math.random) {
  const swaps = []
  for (let i = 0; i < n; i++) {
    const a = Math.floor(rnd() * count)
    let b = Math.floor(rnd() * (count - 1))
    if (b >= a) b++
    swaps.push([a, b])
  }
  return swaps
}
// Dada la posición inicial del premio, dónde acaba tras los intercambios
export function followSwaps (start, swaps) {
  let p = start
  for (const [a, b] of swaps) {
    if (p === a) p = b
    else if (p === b) p = a
  }
  return p
}

// ---------- Examen / adivinanzas ----------
// [pregunta, respuesta correcta, ...incorrectas]
export const QUIZ = {
  examen: [
    ['¿Cuántas Esferas del Dragón hay que reunir para invocar a Shenlong?', '7', '5', '9', '12'],
    ['Si Goku come 3 cuencos de arroz por comida y hace 4 comidas... ¿cuántos cuencos come?', '12', '7', '9', '16'],
    ['¿Cómo se llama la nube amarilla de Goku?', 'Kinton', 'Kamehame', 'Kaio', 'Karin'],
    ['¿Qué capital es la de la Capsule Corporation?', 'Capital del Oeste', 'Capital del Norte', 'Ciudad Satán', 'Pueblo Pingüino'],
    ['¿Cuántas estrellas tiene la esfera del sombrero de Gohan?', '4', '1', '7', '3'],
    ['Si una semilla del ermitaño cura a 1 guerrero, ¿cuántas hacen falta para 5?', '5', '1', '10', '3'],
    ['¿Qué animal es Umigame?', 'Una tortuga', 'Un cerdo', 'Un gato', 'Un dinosaurio'],
    ['¿Quién fue el maestro de Goku y Krilin?', 'El Maestro Roshi', 'Kaio', 'Piccolo', 'Chichí'],
    ['12 ÷ 4 = ?', '3', '4', '6', '8'],
    ['¿De qué color es la piel de Piccolo?', 'Verde', 'Azul', 'Rosa', 'Morada']
  ],
  karin: [
    ['Cuanto más le quitas, más grande se hace. ¿Qué es?', 'Un agujero', 'Una semilla', 'Una nube', 'Una torre'],
    ['Vuela sin alas y llora sin ojos.', 'Una nube', 'Goku', 'Un pájaro', 'Un dragón'],
    ['Tiene dientes y no come, tiene barba y no es hombre.', 'El ajo', 'Roshi', 'Karin', 'Un peine'],
    ['Si me nombras, desaparezco.', 'El silencio', 'Un fantasma', 'La sombra', 'El viento'],
    ['Cuanto más seca, más moja.', 'La toalla', 'La lluvia', 'El sol', 'Una esponja'],
    ['Sube llena y baja vacía... ¿qué es?', 'La cuchara', 'La torre', 'El ascensor', 'La jarra'],
    ['Tengo agujas y no sé coser, tengo números y no sé leer.', 'El reloj', 'El erizo', 'El scouter', 'Un libro'],
    ['Soy blanco como la nieve y en la taza me derrito.', 'El azúcar', 'La leche', 'Una nube', 'El hielo']
  ]
}
export function makeQuizRounds (topic, n, rnd = Math.random, quiz = QUIZ) {
  const bank = [...(quiz[topic] || quiz.examen)].sort(() => rnd() - 0.5).slice(0, n)
  return bank.map(([q, answer, ...wrong]) => ({ q, answer, options: [answer, ...wrong].sort(() => rnd() - 0.5) }))
}

// ---------- Reflejos ----------
// posición de la aguja (0..1) en ida y vuelta a velocidad v (vueltas por segundo)
export function needleAt (t, v) {
  const p = (t * v) % 2
  return p < 1 ? p : 2 - p
}
export const inZone = (pos, zone) => pos >= zone[0] && pos <= zone[1]

// ---------- Memoria ----------
export const CAPSULES = [
  ['🏠', 'Casa'], ['🏍️', 'Moto'], ['✈️', 'Avión'], ['🚤', 'Lancha'], ['🧊', 'Nevera'], ['🚗', 'Coche'], ['🤖', 'Robot'], ['🛸', 'Nave']
]
export function makeDeck (pairs, rnd = Math.random) {
  const chosen = [...CAPSULES].sort(() => rnd() - 0.5).slice(0, pairs)
  return [...chosen, ...chosen].map(([icon, name], i) => ({ id: i, icon, name })).sort(() => rnd() - 0.5)
}

const wait = ms => new Promise(r => setTimeout(r, ms))

// Marcador con esferas del dragón (una por punto)
const Orbs = {
  props: { n: Number, of: Number, side: String },
  template: `<div class="orbs" :class="side"><span v-for="i in of" :key="i" class="orb" :class="{ on: i <= n }">★</span></div>`
}

// ============================================================ JAN-KEN (piedra, papel o tijera)
const RPS_ICON = { piedra: '✊', papel: '✋', tijera: '✌️' }
const RPS_NAME = { piedra: 'Piedra', papel: 'Papel', tijera: 'Tijera' }
const RPS_RESULT = { win: '¡GANAS!', lose: '¡PIERDES!', draw: '¡EMPATE!' }
// "Tells": pistas de lo que va a sacar el rival (aciertan casi siempre)
const RPS_TELLS = {
  piedra: 'Aprieta el puño con fuerza...',
  papel: 'Abre mucho la mano, como para atrapar algo...',
  tijera: 'Mueve dos dedos: chac, chac...'
}

const RockPaperScissors = {
  components: { Orbs },
  props: { config: Object, enemy: Object },
  emits: ['end', 'hit'],
  template: `
    <div class="mg rps">
      <div class="scoreline"><Orbs :n="me" :of="need" side="hero" /><Orbs :n="them" :of="need" side="enemy" /></div>
      <div class="bubble">💬 {{ t(tell) }}</div>
      <div class="clash" :class="phase">
        <div class="hand hero">{{ phase === 'reveal' ? ICON[last.mine] : '✊' }}</div>
        <div class="call">{{ call }}</div>
        <div class="hand enemy">{{ phase === 'reveal' ? ICON[last.theirs] : '✊' }}</div>
        <div v-if="phase === 'reveal'" class="banner" :class="last.result">{{ t(RESULT[last.result]) }}</div>
      </div>
      <div class="choices">
        <button v-for="c in MOVES" :key="c" class="choice" :disabled="busy" @click="play(c)">
          <span class="ico">{{ ICON[c] }}</span><small>{{ t(NAME[c]) }}</small>
        </button>
      </div>
    </div>`,
  setup (props, { emit }) {
    const MOVES = ['piedra', 'papel', 'tijera']
    const need = Math.ceil((props.config?.bestOf || 3) / 2)
    const me = ref(0)
    const them = ref(0)
    const last = ref({ mine: 'piedra', theirs: 'piedra', result: 'draw' })
    const busy = ref(false)
    const phase = ref('idle')
    const call = ref(t('¡Elige!'))
    const history = []
    let planned = rpsEnemyMove(history)
    const tell = ref(RPS_TELLS[planned])

    async function play (mine) {
      busy.value = true
      phase.value = 'shake'
      for (const w of ['¡Jan...', '...Ken...', '¡PON!']) { call.value = t(w); chiptune.sfx('step'); await wait(320) }
      const theirs = planned
      const result = rpsWinner(mine, theirs)
      history.push(mine)
      last.value = { mine, theirs, result }
      phase.value = 'reveal'
      call.value = '💥'
      if (result === 'win') { me.value++; chiptune.sfx('ok'); emit('hit', 'enemy') }
      if (result === 'lose') { them.value++; chiptune.sfx('bad'); emit('hit', 'hero') }
      await wait(1100)
      if (me.value >= need || them.value >= need) { emit('end', me.value >= need); return }
      planned = rpsEnemyMove(history)
      // 80% de las veces la pista es fiable
      tell.value = RPS_TELLS[Math.random() < 0.8 ? planned : MOVES[Math.floor(Math.random() * 3)]]
      phase.value = 'idle'
      call.value = t('¡Elige!')
      busy.value = false
    }
    return { MOVES, ICON: RPS_ICON, NAME: RPS_NAME, RESULT: RPS_RESULT, need, me, them, last, busy, phase, call, tell, play }
  }
}

// ============================================================ TRES EN RAYA
const TicTacToe = {
  components: { Orbs },
  props: { config: Object, enemy: Object },
  emits: ['end', 'hit'],
  template: `
    <div class="mg ttt">
      <div class="scoreline"><Orbs :n="wins" :of="need" side="hero" /><Orbs :n="losses" :of="need" side="enemy" /></div>
      <p class="tell">{{ msg }}</p>
      <div class="ttt-board">
        <button v-for="(c, i) in board" :key="i" class="cell" :class="{ win: winLine.includes(i) }"
          :disabled="!!c || locked" @click="play(i)">
          <span v-if="c === 'O'" class="mark ball">★</span>
          <span v-else-if="c === 'X'" class="mark cross" />
        </button>
      </div>
    </div>`,
  setup (props, { emit }) {
    const need = props.config?.wins || 1
    const level = props.config?.level || 'normal'
    const board = ref(Array(9).fill(null))
    const locked = ref(false)
    const wins = ref(0)
    const losses = ref(0)
    const msg = ref(t('Empiezas tú: consigue tres esferas en línea.'))
    const winLine = ref([])

    function finishRound (w) {
      locked.value = true
      winLine.value = LINES.find(l => l.every(i => board.value[i] === w)) || []
      if (w === 'O') { wins.value++; chiptune.sfx('ok'); msg.value = t('¡Tres en raya!'); emit('hit', 'enemy') } else if (w === 'X') { losses.value++; chiptune.sfx('bad'); msg.value = t('¡{e} gana esta!', { e: tx(props.enemy.name) }); emit('hit', 'hero') } else msg.value = t('¡Empate!')
      setTimeout(() => {
        if (wins.value >= need) return emit('end', true)
        if (losses.value >= need) return emit('end', false)
        board.value = Array(9).fill(null)
        winLine.value = []
        locked.value = false
        msg.value = t('Nueva partida.')
        if (w !== 'O' && Math.random() < 0.5) aiTurn()
      }, 1200)
    }
    function aiTurn () {
      board.value[tttAiMove(board.value, 'X', level)] = 'X'
      const w = tttWinner(board.value)
      if (w) finishRound(w)
    }
    function play (i) {
      board.value[i] = 'O'
      chiptune.sfx('step')
      const w = tttWinner(board.value)
      if (w) return finishRound(w)
      locked.value = true
      msg.value = t('{e} piensa...', { e: tx(props.enemy.name) })
      setTimeout(() => { locked.value = false; msg.value = t('Tu turno.'); aiTurn() }, 450)
    }
    return { need, board, locked, wins, losses, msg, winLine, play }
  }
}

// ============================================================ DUELO DE RIMAS
const RhymeBattle = {
  props: { config: Object, enemy: Object },
  emits: ['end', 'hit'],
  template: `
    <div class="mg rhyme">
      <p class="score">{{ t('Ronda {a}/{b} · Aciertos {h}', { a: round + 1, b: total, h: hits }) }}</p>
      <div class="kibar"><div :style="{ width: (left / seconds * 100) + '%' }" /></div>
      <div class="speech">«{{ current.word.toUpperCase() }}...»</div>
      <p class="tell">{{ t('¿Qué palabra rima?') }}</p>
      <div class="options">
        <button v-for="o in current.options" :key="o" class="scroll" :disabled="answered"
          :class="{ good: answered && o === current.answer, bad: answered && o === picked && o !== current.answer }"
          @click="answer(o)">{{ o }}</button>
      </div>
    </div>`,
  setup (props, { emit }) {
    const total = props.config?.rounds || 5
    const seconds = props.config?.seconds || 8
    const rhymes = i18n.lang === 'ca' ? RHYMES_CA : RHYMES
    const offset = Math.floor(Math.random() * rhymes.length)
    const round = ref(0)
    const hits = ref(0)
    const current = ref(makeRhymeRound(offset, Math.random, rhymes))
    const answered = ref(false)
    const picked = ref(null)
    const left = ref(seconds)
    const iv = setInterval(() => {
      if (answered.value) return
      left.value = Math.max(0, left.value - 0.1)
      if (left.value <= 0) answer(null)
    }, 100)
    onBeforeUnmount(() => clearInterval(iv))

    function answer (o) {
      answered.value = true
      picked.value = o
      if (o === current.value.answer) { hits.value++; chiptune.sfx('ok'); emit('hit', 'enemy') } else { chiptune.sfx('bad'); emit('hit', 'hero') }
      setTimeout(() => {
        if (round.value + 1 >= total) { clearInterval(iv); emit('end', hits.value >= Math.ceil(total * 0.6)); return }
        round.value++
        current.value = makeRhymeRound(offset + round.value, Math.random, rhymes)
        answered.value = false
        picked.value = null
        left.value = seconds
      }, 900)
    }
    return { total, seconds, round, hits, current, answered, picked, left, answer }
  }
}

// ============================================================ SECUENCIA DE KI (tipo Simón)
const KI_PADS = [
  { name: 'Fuego', color: '#ff4a3a', glow: '#ffb09a', note: 'C5' },
  { name: 'Agua', color: '#2f7bff', glow: '#9cc4ff', note: 'E5' },
  { name: 'Rayo', color: '#ffc21a', glow: '#fff09a', note: 'G5' },
  { name: 'Viento', color: '#2fcf6a', glow: '#a8f5c2', note: 'C6' }
]

const KiSequence = {
  props: { config: Object, enemy: Object },
  emits: ['end', 'hit'],
  template: `
    <div class="mg kiseq">
      <p class="score">{{ t('Carga {a}/{b}', { a: seq.length, b: target }) }} · {{ '❤'.repeat(lives) }}</p>
      <div class="charge"><div :style="{ width: Math.round((seq.length - (showing ? 1 : 0)) / target * 100) + '%' }" /></div>
      <p class="tell">{{ t(showing ? 'Observa el ki...' : '¡Tu turno! Repite la secuencia') }}</p>
      <div class="pads">
        <button v-for="(p, i) in PADS" :key="p.name" class="kiorb" :style="{ '--c': p.color, '--g': p.glow }"
          :class="{ lit: lit === i }" :disabled="showing" @click="press(i)"><span>{{ t(p.name) }}</span></button>
      </div>
    </div>`,
  setup (props, { emit }) {
    const target = props.config?.length || 6
    const seq = ref([])
    const input = ref([])
    const lit = ref(-1)
    const showing = ref(true)
    const lives = ref(2)
    const beep = i => { if (chiptune.ensure()) chiptune.tone('pulse', noteToFreq(KI_PADS[i].note), chiptune.ctx.currentTime, 0.2, 0.2) }

    async function show () {
      showing.value = true
      input.value = []
      await wait(600)
      const speed = Math.max(240, 540 - seq.value.length * 40)
      for (const i of seq.value) {
        lit.value = i; beep(i)
        await wait(speed)
        lit.value = -1
        await wait(130)
      }
      showing.value = false
    }
    function press (i) {
      lit.value = i
      beep(i)
      setTimeout(() => { if (lit.value === i) lit.value = -1 }, 160)
      input.value.push(i)
      const k = input.value.length - 1
      if (seq.value[k] !== i) {
        chiptune.sfx('bad'); emit('hit', 'hero')
        lives.value--
        if (lives.value <= 0) { showing.value = true; setTimeout(() => emit('end', false), 700); return }
        show()
        return
      }
      if (input.value.length === seq.value.length) {
        chiptune.sfx('ok'); emit('hit', 'enemy')
        if (seq.value.length >= target) { showing.value = true; setTimeout(() => emit('end', true), 700); return }
        setTimeout(() => { seq.value.push(Math.floor(Math.random() * 4)); show() }, 450)
      }
    }
    onMounted(() => { seq.value = [0, 1, 2].map(() => Math.floor(Math.random() * 4)); show() })
    return { PADS: KI_PADS, target, seq, lit, showing, lives, press }
  }
}

// ============================================================ SIGUE LA JARRA / CONCHA (trile)
const ShellGame = {
  props: { config: Object, enemy: Object },
  emits: ['end', 'hit'],
  template: `
    <div class="mg shell">
      <p class="score">{{ t('Ronda {a}/{b} · Aciertos {h}', { a: round + 1, b: total, h: hits }) }}</p>
      <p class="tell">{{ msg }}</p>
      <div class="shell-table">
        <button v-for="j in 3" :key="j" class="cup" :class="[kind, { lift: reveal && ((j - 1) === prize || (j - 1) === pickedJar), hop: hopping.includes(j - 1) }]"
          :style="{ left: slotLeft(posOf[j - 1]) }" :disabled="phase !== 'pick'" @click="pick(j - 1)">
          <span class="body" />
          <span v-if="reveal && (j - 1) === prize" class="prize">{{ prizeIcon }}</span>
        </button>
      </div>
    </div>`,
  setup (props, { emit }) {
    const total = props.config?.rounds || 3
    const baseSwaps = props.config?.swaps || 6
    const kind = props.config?.item === 'gafas' ? 'seashell' : 'jar'
    const prizeIcon = props.config?.item === 'gafas' ? '🕶️' : '💧'
    const round = ref(0)
    const hits = ref(0)
    const prize = ref(0)
    const posOf = ref([0, 1, 2])
    const phase = ref('show')
    const reveal = ref(true)
    const pickedJar = ref(-1)
    const hopping = ref([])
    const msg = ref('')
    const slotLeft = s => `calc(${s * 33.3}% + 6px)`

    async function playRound () {
      phase.value = 'show'; reveal.value = true; pickedJar.value = -1
      prize.value = Math.floor(Math.random() * 3)
      msg.value = t(kind === 'seashell' ? '¡Las gafas están aquí! No las pierdas de vista.' : 'El agua ultrasagrada está aquí. ¡No la pierdas de vista!')
      await wait(1400)
      reveal.value = false
      await wait(450)
      msg.value = t('{e} lo mezcla todo...', { e: tx(props.enemy.name) })
      const speed = Math.max(200, 460 - round.value * 90)
      for (const [a, b] of randomSwaps(baseSwaps + round.value * 2)) {
        const p = [...posOf.value]
        const ja = p.indexOf(a); const jb = p.indexOf(b)
        p[ja] = b; p[jb] = a
        hopping.value = [ja]
        posOf.value = p
        chiptune.sfx('step')
        await wait(speed)
        hopping.value = []
      }
      phase.value = 'pick'
      msg.value = t(kind === 'seashell' ? '¿Bajo qué concha están las gafas?' : '¿Dónde está el agua?')
    }
    async function pick (j) {
      phase.value = 'result'; pickedJar.value = j; reveal.value = true
      if (j === prize.value) { hits.value++; chiptune.sfx('ok'); msg.value = t('¡Bien visto!'); emit('hit', 'enemy') } else { chiptune.sfx('bad'); msg.value = t('¡Fallaste!'); emit('hit', 'hero') }
      await wait(1300)
      if (round.value + 1 >= total) { emit('end', hits.value > total / 2); return }
      round.value++
      playRound()
    }
    onMounted(playRound)
    return { total, kind, prizeIcon, round, hits, prize, posOf, phase, reveal, pickedJar, hopping, msg, slotLeft, pick }
  }
}

// ============================================================ EXAMEN / ADIVINANZAS
const Quiz = {
  props: { config: Object, enemy: Object },
  emits: ['end', 'hit'],
  template: `
    <div class="mg quiz">
      <p class="score">{{ t('Pregunta {a}/{b} · Aciertos {h}', { a: i + 1, b: rounds.length, h: hits }) }}</p>
      <div class="kibar"><div :style="{ width: (left / seconds * 100) + '%' }" /></div>
      <div class="qcard">{{ cur.q }}</div>
      <div class="options">
        <button v-for="(o, k) in cur.options" :key="o" class="answer" :disabled="answered"
          :class="{ good: answered && o === cur.answer, bad: answered && o === picked && o !== cur.answer }"
          @click="answer(o)"><b>{{ 'ABCD'[k] }}</b> {{ o }}</button>
      </div>
    </div>`,
  setup (props, { emit }) {
    const rounds = makeQuizRounds(props.config?.topic, props.config?.rounds || 5, Math.random, i18n.lang === 'ca' ? QUIZ_CA : QUIZ)
    const seconds = props.config?.seconds || 12
    const i = ref(0)
    const hits = ref(0)
    const answered = ref(false)
    const picked = ref(null)
    const left = ref(seconds)
    const cur = ref(rounds[0])
    const iv = setInterval(() => {
      if (answered.value) return
      left.value = Math.max(0, left.value - 0.1)
      if (left.value <= 0) answer(null)
    }, 100)
    onBeforeUnmount(() => clearInterval(iv))
    function answer (o) {
      answered.value = true
      picked.value = o
      if (o === cur.value.answer) { hits.value++; chiptune.sfx('ok'); emit('hit', 'enemy') } else { chiptune.sfx('bad'); emit('hit', 'hero') }
      setTimeout(() => {
        if (i.value + 1 >= rounds.length) { clearInterval(iv); emit('end', hits.value >= Math.ceil(rounds.length * 0.6)); return }
        i.value++
        cur.value = rounds[i.value]
        answered.value = false; picked.value = null; left.value = seconds
      }, 1100)
    }
    return { rounds, seconds, i, hits, answered, picked, left, cur, answer }
  }
}

// ============================================================ REFLEJOS (pesca / scouter)
const REFLEX_THEMES = {
  fish: { title: '¡Tira cuando el pez muerda!', icon: '🐟', zoneIcon: '🎣', button: '¡TIRAR!', okMsg: '¡Picó!', badMsg: '¡Se escapó!' },
  scouter: { title: 'Sintoniza la frecuencia en la zona verde', icon: '📡', zoneIcon: '📶', button: '¡SINTONIZAR!', okMsg: '¡Señal captada!', badMsg: 'Solo ruido...' }
}
const Reflex = {
  props: { config: Object, enemy: Object },
  emits: ['end', 'hit'],
  template: `
    <div class="mg reflex" :class="theme">
      <p class="score">{{ t('Intento {a}/{b}', { a: Math.min(round + 1, rounds), b: rounds }) }} · {{ t('Aciertos') }} {{ hits }}</p>
      <p class="tell">{{ msg }}</p>
      <div class="meter">
        <div class="zone" :style="{ left: zone[0] * 100 + '%', width: (zone[1] - zone[0]) * 100 + '%' }">{{ T.zoneIcon }}</div>
        <div class="needle" :style="{ left: pos * 100 + '%' }">{{ T.icon }}</div>
      </div>
      <button class="btn primary big-action" :disabled="waiting" @click="shoot">{{ t(T.button) }}</button>
    </div>`,
  setup (props, { emit }) {
    const theme = props.config?.theme || 'fish'
    const T = REFLEX_THEMES[theme] || REFLEX_THEMES.fish
    const rounds = props.config?.rounds || 3
    const round = ref(0)
    const hits = ref(0)
    const pos = ref(0)
    const waiting = ref(false)
    const msg = ref(t(T.title))
    const zone = ref([0, 0])
    let t0 = performance.now(); let speed = 0.6; let raf
    function newZone () {
      const w = Math.max(0.1, 0.22 - round.value * 0.05)
      const s = 0.15 + Math.random() * (0.7 - w)
      zone.value = [s, s + w]
      speed = 0.55 + round.value * 0.25
      t0 = performance.now()
    }
    const loop = () => { pos.value = needleAt((performance.now() - t0) / 1000, speed); raf = requestAnimationFrame(loop) }
    function shoot () {
      waiting.value = true
      const ok = inZone(pos.value, zone.value)
      if (ok) { hits.value++; chiptune.sfx('ok'); msg.value = t(T.okMsg); emit('hit', 'enemy') } else { chiptune.sfx('bad'); msg.value = t(T.badMsg); emit('hit', 'hero') }
      setTimeout(() => {
        round.value++
        if (round.value >= rounds) { cancelAnimationFrame(raf); emit('end', hits.value >= Math.ceil(rounds * 0.6)); return }
        newZone(); waiting.value = false; msg.value = t(T.title)
      }, 900)
    }
    onMounted(() => { newZone(); loop() })
    onBeforeUnmount(() => cancelAnimationFrame(raf))
    return { theme, T, rounds, round, hits, pos, waiting, msg, zone, shoot }
  }
}

// ============================================================ MEMORIA (cápsulas)
const Memory = {
  props: { config: Object, enemy: Object },
  emits: ['end', 'hit'],
  template: `
    <div class="mg memory">
      <p class="score">{{ t('Parejas {a}/{b} · Intentos {n}', { a: found, b: pairs, n: tries }) }}</p>
      <div class="cards">
        <button v-for="(c, k) in deck" :key="c.id" class="card3d" :class="{ flip: open.includes(k) || done.includes(k), done: done.includes(k) }"
          :disabled="busy || done.includes(k) || open.includes(k)" @click="flip(k)">
          <span class="face back">CC</span>
          <span class="face front"><b>{{ c.icon }}</b><small>{{ t(c.name) }}</small></span>
        </button>
      </div>
    </div>`,
  setup (props, { emit }) {
    const pairs = props.config?.pairs || 6
    const deck = makeDeck(pairs)
    const open = ref([])
    const done = ref([])
    const busy = ref(false)
    const found = ref(0)
    const tries = ref(props.config?.tries || pairs * 3)
    function flip (k) {
      open.value = [...open.value, k]
      chiptune.sfx('step')
      if (open.value.length < 2) return
      busy.value = true
      const [a, b] = open.value
      const match = deck[a].name === deck[b].name
      setTimeout(() => {
        if (match) { done.value = [...done.value, a, b]; found.value++; chiptune.sfx('ok'); emit('hit', 'enemy') } else { tries.value--; chiptune.sfx('bad'); emit('hit', 'hero') }
        open.value = []
        busy.value = false
        if (found.value >= pairs) emit('end', true)
        else if (tries.value <= 0) emit('end', false)
      }, match ? 450 : 800)
    }
    return { pairs, deck, open, done, busy, found, tries, flip }
  }
}

// ============================================================ REGISTRO
// Para añadir un minijuego: crea el componente arriba y regístralo aquí.
// emoji: icono para los rivales que no son personajes (un pez, una caja...)
export const MINIGAMES = {
  rps: { name: 'Jan-Ken · Piedra, papel o tijera', component: RockPaperScissors, help: 'Lee la pista del rival y gana al mejor de N.' },
  tictactoe: { name: 'Tres en raya', component: TicTacToe, help: 'Consigue tres esferas del dragón en línea.' },
  rhyme: { name: 'Duelo de rimas', component: RhymeBattle, help: 'Elige la palabra que rima antes de que se agote el ki.' },
  kiseq: { name: 'Secuencia de ki', component: KiSequence, help: 'Repite la secuencia de energía. Cada vez es más larga.' },
  shell: { name: 'Sigue el objeto', component: ShellGame, help: 'Vigila dónde queda el premio mientras lo mezclan.' },
  quiz: { name: 'Examen sorpresa', component: Quiz, help: 'Responde bien a la mayoría de preguntas antes de que acabe el tiempo.' },
  reflex: { name: 'Reflejos', component: Reflex, help: 'Pulsa justo cuando la aguja esté en la zona verde.' },
  memory: { name: 'Memoria de cápsulas', component: Memory, help: 'Encuentra todas las parejas antes de quedarte sin intentos.' }
}
