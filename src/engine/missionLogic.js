// Lógica pura de misiones (sin Vue), fácil de testear.

export function isMissionAvailable (mission, completed) {
  if (mission.enabled === false) return false
  if (completed.includes(mission.id)) return false
  return (mission.requires || []).every(r => completed.includes(r))
}

export function isLocationUnlocked (location, completed) {
  return !location.requires || completed.includes(location.requires)
}

// Props añadidos por la misión que deben verse en el paso actual
export function visibleSpawns (mission, stepIndex) {
  if (!mission) return []
  return (mission.spawns || []).filter(s =>
    stepIndex >= (s.fromStep ?? 0) && stepIndex <= (s.untilStep ?? Infinity))
}

// Qué ocurre al interactuar con un prop dado el estado de la misión
export function resolveInteraction (mission, stepIndex, propId) {
  const step = mission?.steps?.[stepIndex]
  if (step && step.target === propId) return { kind: step.type, step }
  return { kind: 'flavor' }
}

// Valida la estructura mínima de una misión (usado por el panel Admin)
export function validateMission (m, { maps = {}, games = [] } = {}) {
  const errors = []
  if (!m || typeof m !== 'object') return ['La misión debe ser un objeto JSON']
  if (!/^[a-z0-9_]+$/.test(m.id || '')) errors.push('id obligatorio (minúsculas, números y _)')
  if (!m.title) errors.push('title obligatorio')
  if (!m.locationId) errors.push('locationId obligatorio')
  if (!Array.isArray(m.steps) || !m.steps.length) errors.push('steps debe tener al menos un paso')
  const map = maps[m.locationId]
  const ids = new Set([...(map?.props || []), ...(m.spawns || [])].map(p => p.id))
  ;(m.steps || []).forEach((s, i) => {
    if (!['talk', 'goto', 'battle', 'collect'].includes(s.type)) errors.push(`paso ${i}: tipo desconocido "${s.type}"`)
    if (!s.target) errors.push(`paso ${i}: falta target`)
    else if (map && !ids.has(s.target)) errors.push(`paso ${i}: target "${s.target}" no existe en el mapa ni en spawns`)
    if (s.type === 'battle' && games.length && !games.includes(s.game)) errors.push(`paso ${i}: minijuego "${s.game}" desconocido`)
  })
  if (map) {
    for (const sp of m.spawns || []) {
      const row = map.tiles[sp.y]
      if (!row || row[sp.x] === undefined) errors.push(`spawn ${sp.id}: fuera del mapa`)
    }
  }
  return errors
}

// Pathfinding en rejilla (BFS, 4 direcciones). blocked(x,y) → bool.
export function findPath (w, h, blocked, from, to) {
  const key = (x, y) => y * w + x
  const prev = new Map([[key(...from), null]])
  const queue = [from]
  while (queue.length) {
    const [x, y] = queue.shift()
    if (x === to[0] && y === to[1]) {
      const path = []
      let k = key(x, y)
      while (k !== null) {
        path.unshift([k % w, Math.floor(k / w)])
        k = prev.get(k)
      }
      return path.slice(1)
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
      const k = key(nx, ny)
      if (prev.has(k) || blocked(nx, ny)) continue
      prev.set(k, key(x, y))
      queue.push([nx, ny])
    }
  }
  return null
}
