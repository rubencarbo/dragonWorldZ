// Lógica pura de los minijuegos (testeable sin DOM).

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
