import { describe, it, expect } from 'vitest'
import { rpsWinner, tttWinner, tttAiMove, makeRhymeRound, rhymeKey, RHYMES, followSwaps, randomSwaps } from '../src/minigames/logic.js'
import { findPath, validateMission, visibleSpawns, isMissionAvailable, resolveInteraction } from '../src/engine/missionLogic.js'
import { parsePattern, noteToFreq } from '../src/engine/chiptune.js'
import { SEED_MISSIONS } from '../src/data/missions.js'
import { MAPS, TILES } from '../src/data/maps.js'
import { CHARACTERS, PALETTE } from '../src/data/characters.js'
import { TRACKS } from '../src/data/music.js'
import { WORLDS } from '../src/data/worlds.js'

const GAMES = ['rps', 'tictactoe', 'rhyme', 'kiseq', 'shell']

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
        for (const ch of row) if (ch !== '.') expect(PALETTE[ch], `${id}:${ch}`).toBeTruthy()
      }
    }
  })
  it('las pistas de música referenciadas existen', () => {
    for (const m of SEED_MISSIONS) expect(TRACKS[m.music]).toBeTruthy()
    for (const w of WORLDS) expect(TRACKS[w.music]).toBeTruthy()
    for (const map of Object.values(MAPS)) expect(TRACKS[map.music]).toBeTruthy()
    for (const t of Object.values(TRACKS)) for (const e of parsePattern(t.lead)) if (e) expect(e.freq, e.token).toBeTruthy()
  })
})
