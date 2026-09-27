// MINIJUEGOS — combates basados en juegos infantiles.
// Cada minijuego es un componente Vue (props: config, enemy · emite 'end' con
// true/false) registrado en MINIGAMES. La lógica pura va arriba para testearla.
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { chiptune, noteToFreq } from './motor.js'

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
export function makeRhymeRound (i, rnd = Math.random) {
  const [word, answer] = RHYMES[i % RHYMES.length]
  const key = rhymeKey(answer)
  const pool = RHYMES.map(r => r[1]).filter(w => rhymeKey(w) !== key)
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

const wait = ms => new Promise(r => setTimeout(r, ms))

// ============================================================ JAN-KEN (piedra, papel o tijera)
const RPS_ICON = { piedra: '✊', papel: '✋', tijera: '✌️' }
const RPS_NAME = { piedra: 'Piedra', papel: 'Papel', tijera: 'Tijera' }
const RPS_RESULT = { win: '¡GANAS!', lose: 'PIERDES', draw: 'EMPATE' }
// "Tells": pistas de lo que va a sacar el rival (aciertan casi siempre)
const RPS_TELLS = {
  piedra: 'Aprieta las garras con fuerza...',
  papel: 'Abre mucho la boca, como para tragarse algo...',
  tijera: 'Mueve dos dedos, chac, chac...'
}

const RockPaperScissors = {
  props: { config: Object, enemy: Object },
  emits: ['end'],
  template: `
    <div class="mg">
      <p class="score">Tú {{ me }} — {{ them }} {{ enemy.name }}</p>
      <p class="tell">{{ tell }}</p>
      <div class="reveal" v-if="last">
        <span>{{ ICON[last.mine] }}</span><small>vs</small><span>{{ ICON[last.theirs] }}</span>
        <b :class="last.result">{{ RESULT[last.result] }}</b>
      </div>
      <div class="choices">
        <button v-for="c in MOVES" :key="c" class="btn big" :disabled="done" @click="play(c)">
          {{ ICON[c] }}<small>{{ NAME[c] }}</small>
        </button>
      </div>
    </div>`,
  setup (props, { emit }) {
    const MOVES = ['piedra', 'papel', 'tijera']
    const need = Math.ceil((props.config?.bestOf || 3) / 2)
    const me = ref(0)
    const them = ref(0)
    const last = ref(null)
    const done = ref(false)
    const history = []
    let planned = rpsEnemyMove(history)
    const tell = ref(RPS_TELLS[planned])

    function play (mine) {
      const theirs = planned
      const result = rpsWinner(mine, theirs)
      history.push(mine)
      last.value = { mine, theirs, result }
      if (result === 'win') { me.value++; chiptune.sfx('ok') }
      if (result === 'lose') { them.value++; chiptune.sfx('bad') }
      if (me.value >= need || them.value >= need) {
        done.value = true
        setTimeout(() => emit('end', me.value >= need), 900)
        return
      }
      planned = rpsEnemyMove(history)
      // 80% de las veces la pista es fiable
      const shown = Math.random() < 0.8 ? planned : MOVES[Math.floor(Math.random() * 3)]
      tell.value = RPS_TELLS[shown]
    }
    return { MOVES, ICON: RPS_ICON, NAME: RPS_NAME, RESULT: RPS_RESULT, me, them, last, done, tell, play }
  }
}

// ============================================================ TRES EN RAYA
const TicTacToe = {
  props: { config: Object, enemy: Object },
  emits: ['end'],
  template: `
    <div class="mg">
      <p class="score">Tú: ⭕ · {{ enemy.name }}: ❌ · {{ wins }}/{{ need }}</p>
      <p class="tell">{{ msg }}</p>
      <div class="ttt-board">
        <button v-for="(c, i) in board" :key="i" class="cell" :class="{ win: winLine.includes(i) }"
          :disabled="!!c || locked" @click="play(i)">{{ c === 'O' ? '⭕' : c === 'X' ? '❌' : '' }}</button>
      </div>
    </div>`,
  setup (props, { emit }) {
    const need = props.config?.wins || 1
    const level = props.config?.level || 'normal'
    const board = ref(Array(9).fill(null))
    const locked = ref(false)
    const wins = ref(0)
    const losses = ref(0)
    const msg = ref('Empiezas tú. Tres en línea y ganas.')
    const winLine = ref([])

    function finishRound (w) {
      locked.value = true
      winLine.value = LINES.find(l => l.every(i => board.value[i] === w)) || []
      if (w === 'O') { wins.value++; chiptune.sfx('ok'); msg.value = '¡Tres en raya!' } else if (w === 'X') { losses.value++; chiptune.sfx('bad'); msg.value = `${props.enemy.name} gana esta.` } else msg.value = 'Empate... ¡otra!'
      setTimeout(() => {
        if (wins.value >= need) return emit('end', true)
        if (losses.value >= need) return emit('end', false)
        board.value = Array(9).fill(null)
        winLine.value = []
        locked.value = false
        // tras perder o empatar, a veces empieza el rival
        if (w !== 'O' && Math.random() < 0.5) aiTurn()
      }, 1100)
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
      setTimeout(() => { locked.value = false; aiTurn() }, 350)
    }
    return { need, board, locked, wins, msg, winLine, play }
  }
}

// ============================================================ DUELO DE RIMAS
const RhymeBattle = {
  props: { config: Object, enemy: Object },
  emits: ['end'],
  template: `
    <div class="mg">
      <p class="score">Ronda {{ round + 1 }}/{{ total }} · Aciertos {{ hits }}</p>
      <div class="timer"><div :style="{ width: (left / seconds * 100) + '%' }" /></div>
      <p class="say">«{{ current.word.toUpperCase() }}...»</p>
      <p class="tell">¿Qué palabra rima?</p>
      <div class="options">
        <button v-for="o in current.options" :key="o" class="btn" :disabled="answered"
          :class="{ good: answered && o === current.answer, bad: answered && o === picked && o !== current.answer }"
          @click="answer(o)">{{ o }}</button>
      </div>
    </div>`,
  setup (props, { emit }) {
    const total = props.config?.rounds || 5
    const seconds = props.config?.seconds || 8
    const offset = Math.floor(Math.random() * RHYMES.length)
    const round = ref(0)
    const hits = ref(0)
    const current = ref(makeRhymeRound(offset))
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
      if (o === current.value.answer) { hits.value++; chiptune.sfx('ok') } else chiptune.sfx('bad')
      setTimeout(() => {
        if (round.value + 1 >= total) {
          clearInterval(iv)
          emit('end', hits.value >= Math.ceil(total * 0.6))
          return
        }
        round.value++
        current.value = makeRhymeRound(offset + round.value)
        answered.value = false
        picked.value = null
        left.value = seconds
      }, 800)
    }
    return { total, seconds, round, hits, current, answered, picked, left, answer }
  }
}

// ============================================================ SECUENCIA DE KI (tipo Simón)
const KI_PADS = [
  { name: 'ROJO', color: '#d6333a', note: 'C5' },
  { name: 'AZUL', color: '#2250b8', note: 'E5' },
  { name: 'AMARILLO', color: '#e0b020', note: 'G5' },
  { name: 'VERDE', color: '#2f9e44', note: 'C6' }
]

const KiSequence = {
  props: { config: Object, enemy: Object },
  emits: ['end'],
  template: `
    <div class="mg">
      <p class="score">Nivel {{ seq.length }}/{{ target }} · Vidas {{ '❤'.repeat(lives) }}</p>
      <p class="tell">{{ showing ? 'Observa la secuencia de ki...' : 'Tu turno: repítela' }}</p>
      <div class="pads">
        <button v-for="(p, i) in PADS" :key="p.name" class="pad" :style="{ background: p.color }"
          :class="{ lit: lit === i }" :disabled="showing" @click="press(i)">{{ p.name }}</button>
      </div>
    </div>`,
  setup (props, { emit }) {
    const target = props.config?.length || 6
    const seq = ref([])
    const input = ref([])
    const lit = ref(-1)
    const showing = ref(true)
    const lives = ref(2)

    function beep (i) {
      if (chiptune.ensure()) chiptune.tone('pulse', noteToFreq(KI_PADS[i].note), chiptune.ctx.currentTime, 0.2, 0.2)
    }
    async function show () {
      showing.value = true
      input.value = []
      await wait(500)
      const speed = Math.max(220, 520 - seq.value.length * 40)
      for (const i of seq.value) {
        lit.value = i
        beep(i)
        await wait(speed)
        lit.value = -1
        await wait(120)
      }
      showing.value = false
    }
    function grow () {
      seq.value.push(Math.floor(Math.random() * 4))
      show()
    }
    function press (i) {
      lit.value = i
      beep(i)
      setTimeout(() => { if (lit.value === i) lit.value = -1 }, 150)
      input.value.push(i)
      const k = input.value.length - 1
      if (seq.value[k] !== i) {
        chiptune.sfx('bad')
        lives.value--
        if (lives.value <= 0) { showing.value = true; setTimeout(() => emit('end', false), 600); return }
        show()
        return
      }
      if (input.value.length === seq.value.length) {
        chiptune.sfx('ok')
        if (seq.value.length >= target) { showing.value = true; setTimeout(() => emit('end', true), 600); return }
        setTimeout(grow, 400)
      }
    }
    onMounted(() => { seq.value = [0, 1, 2].map(() => Math.floor(Math.random() * 4)); show() })
    return { PADS: KI_PADS, target, seq, lit, showing, lives, press }
  }
}

// ============================================================ SIGUE LA JARRA (trile)
const ShellGame = {
  props: { config: Object, enemy: Object },
  emits: ['end'],
  template: `
    <div class="mg">
      <p class="score">Ronda {{ round + 1 }}/{{ total }} · Aciertos {{ hits }}</p>
      <p class="tell">{{ msg }}</p>
      <div class="shell-table">
        <button v-for="j in 3" :key="j" class="jar" :style="{ left: slotLeft(posOf[j - 1]) }"
          :class="{ lift: reveal && ((j - 1) === prize || (j - 1) === pickedJar) }"
          :disabled="phase !== 'pick'" @click="pick(j - 1)">
          <span class="pot">🏺</span>
          <span v-if="reveal && (j - 1) === prize" class="water">💧</span>
        </button>
      </div>
    </div>`,
  setup (props, { emit }) {
    const total = props.config?.rounds || 3
    const baseSwaps = props.config?.swaps || 6
    const round = ref(0)
    const hits = ref(0)
    const prize = ref(0) // jarra (objeto) que tiene el agua
    const posOf = ref([0, 1, 2]) // hueco que ocupa cada jarra
    const phase = ref('show')
    const reveal = ref(true)
    const pickedJar = ref(-1)
    const msg = ref('')
    const slotLeft = s => `calc(${s * 33.3}% + 4px)`

    async function playRound () {
      phase.value = 'show'
      reveal.value = true
      pickedJar.value = -1
      prize.value = Math.floor(Math.random() * 3)
      msg.value = 'El agua ultrasagrada está aquí. ¡No la pierdas de vista!'
      await wait(1300)
      reveal.value = false
      await wait(400)
      msg.value = `${props.enemy.name} mueve las jarras...`
      const speed = Math.max(180, 420 - round.value * 90)
      for (const [a, b] of randomSwaps(baseSwaps + round.value * 2)) {
        // a y b son huecos: intercambia las jarras que los ocupan
        const p = [...posOf.value]
        const ja = p.indexOf(a)
        const jb = p.indexOf(b)
        p[ja] = b
        p[jb] = a
        posOf.value = p
        chiptune.sfx('step')
        await wait(speed)
      }
      phase.value = 'pick'
      msg.value = '¿Dónde está el agua?'
    }
    async function pick (j) {
      phase.value = 'result'
      pickedJar.value = j
      reveal.value = true
      if (j === prize.value) { hits.value++; chiptune.sfx('ok'); msg.value = '¡Bien visto!' } else { chiptune.sfx('bad'); msg.value = '¡Fallaste!' }
      await wait(1200)
      if (round.value + 1 >= total) { emit('end', hits.value > total / 2); return }
      round.value++
      playRound()
    }
    onMounted(playRound)
    return { total, round, hits, prize, posOf, phase, reveal, pickedJar, msg, slotLeft, pick }
  }
}

// ============================================================ REGISTRO
// Para añadir un minijuego: crea el componente arriba y regístralo aquí.
export const MINIGAMES = {
  rps: { name: 'Jan-Ken (piedra, papel o tijera)', component: RockPaperScissors, help: 'Lee la pista del rival y gana al mejor de N.' },
  tictactoe: { name: 'Tres en raya', component: TicTacToe, help: 'Consigue tres ⭕ en línea.' },
  rhyme: { name: 'Duelo de rimas', component: RhymeBattle, help: 'Elige la palabra que rima antes de que acabe el tiempo.' },
  kiseq: { name: 'Secuencia de ki', component: KiSequence, help: 'Repite la secuencia de colores. Cada vez es más larga.' },
  shell: { name: 'Sigue la jarra', component: ShellGame, help: 'Vigila dónde queda el agua ultrasagrada.' }
}
