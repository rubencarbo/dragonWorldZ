import { describe, it, expect } from 'vitest'
import { rpsWinner, tttWinner, tttAiMove, makeRhymeRound, rhymeKey, RHYMES, followSwaps, randomSwaps, makeQuizRounds, QUIZ, needleAt, inZone, makeDeck } from '../minijuegos.js'
import { findPath, validateMission, visibleSpawns, isMissionAvailable, resolveInteraction } from '../motor.js'
import { parsePattern, noteToFreq, FM_INSTRUMENTS } from '../motor.js'
import { SEED_MISSIONS } from '../mundos.js'
import { MAPS, TILES } from '../mundos.js'
import { CHARACTERS, PALETTE, FORMS } from '../personajes.js'
import { TRACKS } from '../mundos.js'
import { WORLDS } from '../mundos.js'

const GAMES = ['rps', 'tictactoe', 'rhyme', 'kiseq', 'shell', 'quiz', 'reflex', 'memory']

describe('minijuegos', () => {
  it('piedra papel tijera', () => {
    expect(rpsWinner('piedra', 'tijera')).toBe('win')
    expect(rpsWinner('piedra', 'papel')).toBe('lose')
    expect(rpsWinner('papel', 'papel')).toBe('draw')
  })
  it('tres en raya: detecta ganador y la IA bloquea', () => {
    expect(tttWinner(['X', 'X', 'X', null, null, null, null, null, null])).toBe('X')
    const b = ['O', 'O', null, null, 'X', null, null, null, null]
    expect(tttAiMove(b, 'X', 'hard')).toBe(2)
  })
  it('rimas: la respuesta está entre las opciones y los distractores no riman', () => {
    for (let i = 0; i < RHYMES.length; i++) {
      const r = makeRhymeRound(i)
      expect(r.options).toContain(r.answer)
      expect(new Set(r.options).size).toBe(4)
      expect(r.options.filter(o => rhymeKey(o) === rhymeKey(r.answer))).toHaveLength(1)
    }
  })
  it('examen: cada pregunta tiene 4 opciones distintas con la correcta', () => {
    for (const topic of Object.keys(QUIZ)) {
      for (const r of makeQuizRounds(topic, 99)) {
        expect(r.options).toContain(r.answer)
        expect(new Set(r.options).size).toBe(4)
      }
    }
  })
  it('reflejos y memoria', () => {
    expect(needleAt(0, 1)).toBe(0)
    expect(needleAt(0.5, 1)).toBe(0.5)
    expect(needleAt(1.5, 1)).toBe(0.5)
    expect(inZone(0.3, [0.2, 0.4])).toBe(true)
    const deck = makeDeck(6)
    expect(deck).toHaveLength(12)
    for (const c of deck) expect(deck.filter(d => d.name === c.name)).toHaveLength(2)
  })
  it('trile: seguir los intercambios', () => {
    expect(followSwaps(0, [[0, 1], [1, 2]])).toBe(2)
    for (const [a, b] of randomSwaps(20)) expect(a).not.toBe(b)
  })
})

describe('motor', () => {
  it('pathfinding evita obstáculos', () => {
    const wall = (x, y) => x === 1 && y < 2
    const p = findPath(3, 3, wall, [0, 0], [2, 0])
    expect(p.at(-1)).toEqual([2, 0])
    expect(p.some(([x, y]) => wall(x, y))).toBe(false)
    expect(findPath(3, 1, (x) => x === 1, [0, 0], [2, 0])).toBeNull()
  })
  it('spawns por paso y requisitos', () => {
    const m = SEED_MISSIONS[0]
    expect(visibleSpawns(m, 0).map(s => s.id)).toEqual([])
    expect(visibleSpawns(m, 2).map(s => s.id)).toEqual(['huellas', 'dino'])
    expect(isMissionAvailable(SEED_MISSIONS[1], [])).toBe(false)
    expect(isMissionAvailable(SEED_MISSIONS[1], ['m_esfera4'])).toBe(true)
    expect(resolveInteraction(m, 0, 'altar').kind).toBe('talk')
    expect(resolveInteraction(m, 0, 'cartel').kind).toBe('flavor')
  })
  it('música: parseo de patrones', () => {
    expect(Math.round(noteToFreq('A4'))).toBe(440)
    const ev = parsePattern('C5 - - . E5')
    expect(ev[0].len).toBe(3)
    expect(ev[4].freq).toBeGreaterThan(600)
  })
})

describe('datos', () => {
  it('todas las misiones semilla son válidas', () => {
    for (const m of SEED_MISSIONS) expect(validateMission(m, { maps: MAPS, games: GAMES }), m.id).toEqual([])
  })
  it('cada lugar con mapa tiene al menos 2 misiones y ningún spawn pisa otro objeto', () => {
    for (const id of Object.keys(MAPS)) {
      const ms = SEED_MISSIONS.filter(m => m.locationId === id)
      expect(ms.length, id).toBeGreaterThanOrEqual(2)
      for (const m of ms) {
        for (let step = 0; step < m.steps.length; step++) {
          const visible = [...MAPS[id].props, ...visibleSpawns(m, step)]
          const cells = visible.map(p => `${p.x},${p.y}`)
          expect(new Set(cells).size, `${m.id} paso ${step}`).toBe(cells.length)
          expect(visible.some(p => p.id === m.steps[step].target), `${m.id} paso ${step}: objetivo visible`).toBe(true)
          expect(`${MAPS[id].start}`, `${m.id}: inicio libre`).not.toBe(cells.find(c => c === `${MAPS[id].start}`))
        }
      }
    }
  })
  it('mapas rectangulares, con tiles conocidos y props sobre casillas transitables', () => {
    for (const [id, map] of Object.entries(MAPS)) {
      const w = map.tiles[0].length
      for (const row of map.tiles) {
        expect(row.length, id).toBe(w)
        for (const ch of row) expect(TILES[ch], `${id}:${ch}`).toBeTruthy()
      }
      const props = [...map.props, ...SEED_MISSIONS.filter(m => m.locationId === id).flatMap(m => m.spawns || [])]
      for (const p of [...props, { id: 'start', x: map.start[0], y: map.start[1] }]) {
        expect(TILES[map.tiles[p.y][p.x]].walk, `${id}:${p.id}`).toBe(true)
      }
    }
  })
  it('sprites con filas del mismo ancho y colores de la paleta', () => {
    for (const [id, c] of Object.entries(CHARACTERS)) {
      const w = c.grid[0].length
      for (const row of c.grid) {
        expect(row.length, id).toBe(w)
        for (const ch of row) if (ch !== '.') expect((c.palette || PALETTE)[ch], `${id}:${ch}`).toBeTruthy()
      }
    }
  })
  it('el generador produce personajes con contorno y tamaño estable', () => {
    for (const [id, c] of Object.entries(CHARACTERS).filter(([, c]) => c.spec)) {
      expect(c.grid.length, id).toBeGreaterThan(60)
      expect(Object.values(c.palette), id).toContain('#141020') // contorno
    }
  })
  it('protagonistas con sprite real y transformaciones válidas', () => {
    for (const id of ['goku', 'gohan', 'krilin', 'vegeta', 'piccolo', 'bulma']) {
      expect(CHARACTERS[id].spec, id).toBeFalsy()
      expect(CHARACTERS[id].grid.length, id).toBeGreaterThan(40)
    }
    for (const [id, forms] of Object.entries(FORMS)) {
      expect(forms[0]).toBe(id)
      for (const f of forms) expect(CHARACTERS[f], f).toBeTruthy()
    }
  })
  it('las pistas de música referenciadas existen', () => {
    for (const m of SEED_MISSIONS) expect(TRACKS[m.music]).toBeTruthy()
    for (const w of WORLDS) expect(TRACKS[w.music]).toBeTruthy()
    for (const map of Object.values(MAPS)) expect(TRACKS[map.music]).toBeTruthy()
    for (const t of Object.values(TRACKS)) {
      for (const ch of ['lead', 'bass', 'pad']) for (const e of parsePattern(t[ch])) if (e) for (const f of e.freqs) expect(f, e.token).toBeTruthy()
      // los canales encajan en compás: todos dividen la longitud del más largo
      const lens = ['lead', 'bass', 'pad', 'drums'].map(ch => (t[ch] || '').trim().split(/\s+/).filter(Boolean).length).filter(Boolean)
      const max = Math.max(...lens)
      for (const n of lens) expect(max % n).toBe(0)
      for (const i of Object.values(t.inst || {})) expect(FM_INSTRUMENTS[i], i).toBeTruthy()
    }
    expect(parsePattern('C4+E4+G4 - -')[0].freqs.length).toBe(3)
  })
})

// ---------- idiomas ----------
describe('català', () => {
  it('todos los textos de mundos, mapas y misiones tienen traducción', async () => {
    const { t, i18n, RHYMES_CA, QUIZ_CA } = await import('../idiomas.js')
    const { SEED_MISSIONS, WORLDS, MAPS } = await import('../mundos.js')
    const KEYS = new Set(['who', 'text', 'title', 'summary', 'hint', 'name', 'desc', 'saga', 'timeline'])
    const missing = []
    i18n.lang = 'ca'
    const walk = (o, k) => {
      if (typeof o === 'string') {
        if (KEYS.has(k) && /[a-záéíóúñ]{2}/i.test(o) && t(o) === o && /[áéíóúñ¡¿]|\b(el|la|los|las|de|y|que|con)\b/i.test(o)) missing.push(o)
      } else if (Array.isArray(o)) o.forEach(x => walk(x, k))
      else if (o && typeof o === 'object') for (const [kk, v] of Object.entries(o)) walk(v, kk)
    }
    walk(SEED_MISSIONS); walk(WORLDS); walk(MAPS)
    i18n.lang = 'es'
    expect(missing).toEqual([])
    expect(RHYMES_CA.length).toBeGreaterThanOrEqual(12)
    expect(QUIZ_CA.examen.length).toBeGreaterThanOrEqual(5)
    expect(QUIZ_CA.karin.length).toBeGreaterThanOrEqual(5)
  })
  it('se conserva «Kamehameha» (nunca «ona vital»)', async () => {
    const src = (await import('fs')).readFileSync(new URL('../idiomas.js', import.meta.url), 'utf8')
    expect(src.replace(/\/\/.*$/gm, '')).not.toMatch(/ona vital/i)
  })
})

// ---------- Modo Historia ----------
describe('Libro 1', () => {
  it('guion válido: escenas, personajes, minijuegos y textos en los dos idiomas', async () => {
    const { BOOKS, SCENES } = await import('../historia.js')
    const { MINIGAMES } = await import('../minijuegos.js')
    const problems = []
    const checkText = (v, where) => { if (!v?.es || !v?.ca) problems.push('texto sin idioma en ' + where) }
    for (const book of BOOKS) {
      expect(book.chapters.length).toBeGreaterThanOrEqual(6)
      for (const ch of book.chapters) {
        if (!CHARACTERS[ch.hero]) problems.push(`${ch.id}: protagonista ${ch.hero}`)
        checkText(ch.title, ch.id)
        ch.pages.forEach((p, i) => {
          const where = `${ch.id} pág ${i + 1}`
          if (!SCENES[p.scene]) problems.push(`${where}: escena ${p.scene}`)
          const actors = [...(p.actors || [])]
          const beats = [...(p.beats || []), ...(p.win || []), ...(p.lose || []), ...(p.done || []), ...(p.spots || []).flatMap(s => s.lines)]
          for (const b of beats) {
            actors.push(...(b.add || []))
            const txt = b.cap || b.me || b.say || b.fx
            checkText(txt, where)
            if (b.say && !book.names[b.who] && !actors.some(a => (a.key || a.id) === b.who)) problems.push(`${where}: habla ${b.who} y no está en la viñeta`)
          }
          for (const a of actors) if (a.id && !CHARACTERS[a.id]) problems.push(`${where}: sprite ${a.id}`)
          if (p.type === 'battle' && !MINIGAMES[p.game]) problems.push(`${where}: minijuego ${p.game}`)
          if (p.type === 'explore' && !(p.spots || []).some(s => s.need)) problems.push(`${where}: exploración sin pistas clave`)
        })
      }
    }
    expect(problems).toEqual([])
  })
})
