// MOTOR — piezas técnicas reutilizables (sin estado de juego):
//   · renderer retro (baja resolución + pixelado)
//   · vóxeles (sprite → 3D, imagen → sprite) y modelos de objetos/lugares
//   · planeta procedural low-poly y utilidades lat/lon
//   · sintetizador chiptune (música y efectos)
//   · lógica pura de misiones y pathfinding
import * as THREE from 'three'
import { CHARACTERS, PALETTE } from './personajes.js'
import { TRACKS } from './mundos.js'

// ============================================================ RENDERER RETRO

// pixelSize = cuántos píxeles físicos de la pantalla ocupa cada píxel del juego.
//   1 → nítido (resolución nativa) · 2 → retro suave · 3-4 → 8 bits marcado
// Se tiene en cuenta la densidad de la pantalla (devicePixelRatio), así el
// aspecto es igual en un móvil con pantalla retina que en un monitor normal.
export function createRetroRenderer (container, { pixelSize = 2 } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' })
  renderer.setPixelRatio(1)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap
  const canvas = renderer.domElement
  canvas.style.width = '100%'
  canvas.style.height = '100%'
  canvas.style.imageRendering = 'pixelated'
  canvas.style.display = 'block'
  canvas.style.touchAction = 'none'
  container.appendChild(canvas)

  const state = { pixelSize, onResize: null }
  // límite de densidad para no fundir la GPU de móviles con pantallas 3x
  const dpr = Math.min(globalThis.devicePixelRatio || 1, 2.5)

  function resize () {
    const w = container.clientWidth || 1
    const h = container.clientHeight || 1
    const k = dpr / state.pixelSize
    renderer.setSize(Math.ceil(w * k), Math.ceil(h * k), false)
    // con resolución casi nativa el pixelado ya no aporta: suavizado del navegador
    canvas.style.imageRendering = state.pixelSize <= 1 ? 'auto' : 'pixelated'
    state.onResize?.(w, h)
  }
  const ro = new ResizeObserver(resize)
  ro.observe(container)
  resize()

  return {
    renderer,
    canvas,
    set pixelSize (v) { state.pixelSize = v; resize() },
    set onResize (fn) { state.onResize = fn; resize() },
    dispose () {
      ro.disconnect()
      renderer.dispose()
      canvas.remove()
    }
  }
}

// Gestos táctiles y de ratón sobre un canvas, estilo Google Maps:
//   · tocar           → onTap(event)
//   · arrastrar       → onDrag(dx, dy) en píxeles CSS
//   · pellizcar/rueda → onZoom(factor)  (>1 acercar, <1 alejar)
// Devuelve una función para desconectar los eventos.
export function attachGestures (canvas, { onTap, onDrag, onZoom }) {
  const pointers = new Map()
  let moved = 0
  let pinchDist = 0
  let multi = false

  const dist = () => {
    const [a, b] = [...pointers.values()]
    return Math.hypot(a.x - b.x, a.y - b.y)
  }
  function down (e) {
    try { canvas.setPointerCapture(e.pointerId) } catch {}
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.size === 1) { moved = 0; multi = false }
    if (pointers.size === 2) { pinchDist = dist(); multi = true }
  }
  function move (e) {
    const p = pointers.get(e.pointerId)
    if (!p) return
    const dx = e.clientX - p.x
    const dy = e.clientY - p.y
    p.x = e.clientX
    p.y = e.clientY
    if (pointers.size >= 2) {
      const d = dist()
      if (pinchDist > 0 && d > 0) onZoom?.(d / pinchDist)
      pinchDist = d
      return
    }
    moved += Math.abs(dx) + Math.abs(dy)
    if (moved > 6 && !multi) onDrag?.(dx, dy)
  }
  function up (e) {
    if (!pointers.has(e.pointerId)) return
    pointers.delete(e.pointerId)
    if (pointers.size === 0 && !multi && moved <= 6 && e.type === 'pointerup') onTap?.(e)
    if (pointers.size < 2) pinchDist = 0
  }
  function wheel (e) {
    e.preventDefault()
    onZoom?.(Math.exp(-e.deltaY * 0.0015))
  }
  canvas.addEventListener('pointerdown', down)
  canvas.addEventListener('pointermove', move)
  canvas.addEventListener('pointerup', up)
  canvas.addEventListener('pointercancel', up)
  canvas.addEventListener('wheel', wheel, { passive: false })
  return () => {
    canvas.removeEventListener('pointerdown', down)
    canvas.removeEventListener('pointermove', move)
    canvas.removeEventListener('pointerup', up)
    canvas.removeEventListener('pointercancel', up)
    canvas.removeEventListener('wheel', wheel)
  }
}

// Coordenadas normalizadas (-1..1) de un evento de puntero sobre el canvas
export function pointerNDC (event, canvas) {
  const r = canvas.getBoundingClientRect()
  return new THREE.Vector2(((event.clientX - r.left) / r.width) * 2 - 1, -((event.clientY - r.top) / r.height) * 2 + 1)
}

// ============================================================ VÓXELES

const box = new THREE.BoxGeometry(1, 1, 1)

// grid: array de strings; palette: {char: '#hex'}
// Devuelve un Group centrado en X/Z con la base en y=0.
export function spriteToVoxels (grid, palette = PALETTE, { size = 0.1, depth = 2 } = {}) {
  const cells = []
  const h = grid.length
  const w = Math.max(...grid.map(r => r.length))
  grid.forEach((row, y) => {
    ;[...row].forEach((ch, x) => {
      if (ch !== '.' && ch !== ' ' && palette[ch]) cells.push({ x, y: h - 1 - y, color: palette[ch] })
    })
  })
  const group = new THREE.Group()
  const mat = new THREE.MeshLambertMaterial()
  const mesh = new THREE.InstancedMesh(box, mat, cells.length * depth)
  const m = new THREE.Matrix4()
  const c = new THREE.Color()
  let i = 0
  for (const cell of cells) {
    for (let d = 0; d < depth; d++) {
      m.makeScale(size, size, size)
      m.setPosition((cell.x - w / 2 + 0.5) * size, (cell.y + 0.5) * size, (d - depth / 2 + 0.5) * size)
      mesh.setMatrixAt(i, m)
      mesh.setColorAt(i, c.set(cell.color))
      i++
    }
  }
  mesh.castShadow = true
  group.add(mesh)
  group.userData.height = h * size
  return group
}

// Modelos de bloques sencillos: lista de [x, y, z, sx, sy, sz, color]
export function blocks (list) {
  const g = new THREE.Group()
  for (const [x, y, z, sx, sy, sz, color] of list) {
    const mesh = new THREE.Mesh(box, new THREE.MeshLambertMaterial({ color }))
    mesh.scale.set(sx, sy, sz)
    mesh.position.set(x, y + sy / 2, z)
    mesh.castShadow = true
    g.add(mesh)
  }
  return g
}

// Convierte una imagen (HTMLImageElement/Canvas) en rejilla pixel-art de
// `size` px de alto, reduciendo a una paleta de como máximo `maxColors`.
// Devuelve { grid, palette } compatible con spriteToVoxels.
export function imageToGrid (img, { size = 24, maxColors = 12, alphaCut = 128 } = {}) {
  const ratio = img.width / img.height
  const h = size
  const w = Math.max(1, Math.round(size * ratio))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(img, 0, 0, w, h)
  const { data } = ctx.getImageData(0, 0, w, h)
  const pixels = []
  for (let i = 0; i < data.length; i += 4) {
    pixels.push(data[i + 3] < alphaCut ? null : [data[i], data[i + 1], data[i + 2]])
  }
  const centers = quantize(pixels.filter(Boolean), maxColors)
  const keys = 'abcdefghijklmnopqrstuvwxyz'
  const palette = {}
  centers.forEach((c, i) => { palette[keys[i]] = rgbToHex(c) })
  const grid = []
  for (let y = 0; y < h; y++) {
    let row = ''
    for (let x = 0; x < w; x++) {
      const p = pixels[y * w + x]
      row += p ? keys[nearest(centers, p)] : '.'
    }
    grid.push(row)
  }
  return { grid, palette }
}

function nearest (centers, p) {
  let best = 0
  let bd = Infinity
  centers.forEach((c, i) => {
    const d = (c[0] - p[0]) ** 2 + (c[1] - p[1]) ** 2 + (c[2] - p[2]) ** 2
    if (d < bd) { bd = d; best = i }
  })
  return best
}

// k-means sencillo, suficiente para sprites pequeños
export function quantize (pixels, k) {
  if (!pixels.length) return [[0, 0, 0]]
  const step = Math.max(1, Math.floor(pixels.length / k))
  let centers = []
  for (let i = 0; i < pixels.length && centers.length < k; i += step) centers.push([...pixels[i]])
  for (let iter = 0; iter < 8; iter++) {
    const sums = centers.map(() => [0, 0, 0, 0])
    for (const p of pixels) {
      const s = sums[nearest(centers, p)]
      s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; s[3]++
    }
    centers = sums.map((s, i) => s[3] ? [s[0] / s[3], s[1] / s[3], s[2] / s[3]] : centers[i])
  }
  return centers.map(c => c.map(Math.round))
}

function rgbToHex ([r, g, b]) {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')
}

// ============================================================ MODELOS

// Sprites personalizados (Admin → Sprites). La app registra aquí su mapa
// reactivo { id: { grid, palette } } y el motor lo consulta al crear modelos.
let customSprites = {}
export function registerCustomSprites (map) { customSprites = map }

export function characterModel (id, size = 0.06) {
  const sprite = customSprites[id] || CHARACTERS[id] || CHARACTERS.goku
  const palette = sprite.palette || PALETTE
  // la altura final es la misma aunque el sprite tenga más resolución
  const rows = sprite.grid.length
  const voxel = (16 * size) / rows
  return spriteToVoxels(sprite.grid, palette, { size: voxel, depth: Math.max(2, Math.round(3 * rows / 16)) })
}

export function characterName (id) {
  return customSprites[id]?.name || CHARACTERS[id]?.name || id
}

export function kintonModel () {
  const y = '#f6d33c'
  const o = '#f0b429'
  return blocks([
    [0, 0, 0, 0.8, 0.18, 0.5, y],
    [-0.35, 0.08, 0, 0.35, 0.2, 0.35, y],
    [0.35, 0.08, 0, 0.35, 0.2, 0.35, y],
    [0.55, -0.02, 0, 0.3, 0.12, 0.2, o],
    [-0.62, 0.02, 0, 0.25, 0.1, 0.18, o]
  ])
}

export function dragonBallModel (stars = 4, r = 0.18) {
  const g = new THREE.Group()
  const ball = new THREE.Mesh(
    new THREE.IcosahedronGeometry(r, 1),
    new THREE.MeshLambertMaterial({ color: '#ff9a1f', emissive: '#7a3300', flatShading: true })
  )
  ball.position.y = r
  g.add(ball)
  const star = new THREE.MeshBasicMaterial({ color: '#d6333a' })
  const pos = [[0, 0.05], [-0.05, -0.04], [0.05, -0.04], [0, -0.1], [0.07, 0.07], [-0.07, 0.07], [0, 0.12]]
  for (let i = 0; i < stars; i++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.02), star)
    s.position.set(pos[i][0] * r * 5, r + pos[i][1] * r * 5, r * 0.95)
    g.add(s)
  }
  return g
}

export function propModel (prop) {
  switch (prop.kind) {
    case 'npc': return characterModel(prop.sprite, 0.055)
    case 'ball': return dragonBallModel(prop.stars || 1)
    case 'cabin': return blocks([
      [0, 0, 0, 0.9, 0.55, 0.8, '#c98e4a'],
      [0, 0.55, 0, 1.0, 0.18, 0.9, '#b23a2a'],
      [0, 0.73, 0, 0.7, 0.14, 0.9, '#b23a2a'],
      [0, 0.87, 0, 0.35, 0.1, 0.9, '#b23a2a'],
      [0, 0, 0.41, 0.25, 0.38, 0.02, '#5a3314'],
      [0.28, 0.2, 0.41, 0.18, 0.15, 0.02, '#8fd3ff']
    ])
    case 'altar': return blocks([
      [0, 0, 0, 0.6, 0.35, 0.4, '#7c4a22'],
      [0, 0.35, 0, 0.3, 0.06, 0.3, '#c0392b'],
      [0, 0.41, 0, 0.44, 0.35, 0.05, '#e8d3a0']
    ])
    case 'sign': return blocks([
      [0, 0, 0, 0.08, 0.5, 0.08, '#7c4a22'],
      [0, 0.4, 0, 0.6, 0.3, 0.06, '#c98e4a']
    ])
    case 'kamehouse': return blocks([
      [0, 0, 0, 0.95, 0.6, 0.8, '#f29ec0'],
      [0, 0.6, 0, 1.05, 0.2, 0.9, '#d6333a'],
      [0, 0.8, 0, 0.75, 0.15, 0.9, '#d6333a'],
      [0, 0.35, 0.41, 0.6, 0.1, 0.02, '#f4f4f4'],
      [0, 0, 0.41, 0.22, 0.3, 0.02, '#7c4a22']
    ])
    case 'palm': return blocks([
      [0, 0, 0, 0.12, 0.9, 0.12, '#9c6b3a'],
      [0, 0.9, 0, 0.8, 0.08, 0.2, '#3e9b3e'],
      [0, 0.9, 0, 0.2, 0.08, 0.8, '#3e9b3e'],
      [0.1, 0.82, 0.1, 0.12, 0.12, 0.12, '#6b4a2a']
    ])
    case 'dome': {
      const g = new THREE.Group()
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(0.75, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshLambertMaterial({ color: '#f1f1f1', flatShading: true })
      )
      dome.castShadow = true
      g.add(dome)
      g.add(blocks([
        [0, 0, 0.7, 0.35, 0.3, 0.1, '#2250b8'],
        [0, 0.4, 0.68, 0.5, 0.08, 0.02, '#2250b8']
      ]))
      return g
    }
    case 'crate': return blocks([
      [0, 0, 0, 0.5, 0.4, 0.5, '#9a9aa8'],
      [-0.1, 0.4, 0, 0.12, 0.1, 0.12, '#d6333a'],
      [0.1, 0.4, 0.05, 0.12, 0.1, 0.12, '#f6d33c']
    ])
    case 'jar': return blocks([
      [0, 0, 0, 0.3, 0.3, 0.3, '#e0e0e8'],
      [0, 0.3, 0, 0.14, 0.12, 0.14, '#e0e0e8'],
      [0, 0.15, 0.151, 0.14, 0.1, 0.01, '#5fc9d8']
    ])
    case 'pillar': return blocks([
      [0, 0, 0, 0.3, 1.1, 0.3, '#f2e3c2'],
      [0, 1.1, 0, 0.45, 0.1, 0.45, '#d9c49a']
    ])
    case 'footprints': return blocks([
      [-0.15, 0, -0.2, 0.18, 0.02, 0.26, '#5a3a1a'],
      [0.15, 0, 0.15, 0.18, 0.02, 0.26, '#5a3a1a']
    ])
    case 'bean': return blocks([
      [0, 0.05, 0, 0.14, 0.1, 0.09, '#6fcf4a'],
      [0, 0, 0, 0.3, 0.05, 0.3, '#c98e4a']
    ])
    case 'tower': return blocks([
      [0, 0, 0, 0.14, 1.6, 0.14, '#f2e3c2'],
      [0, 1.6, 0, 0.35, 0.12, 0.35, '#d9c49a'],
      [0, 1.72, 0, 0.18, 0.18, 0.18, '#e0e0e8']
    ])
    default: return blocks([[0, 0, 0, 0.3, 0.3, 0.3, '#ff00ff']])
  }
}

export function treeModel () {
  return blocks([
    [0, 0, 0, 0.18, 0.4, 0.18, '#7c4a22'],
    [0, 0.4, 0, 0.7, 0.4, 0.7, '#2f7d32'],
    [0, 0.8, 0, 0.45, 0.3, 0.45, '#3e9b3e']
  ])
}

// ============================================================ PLANETA

function hash (x, y, z) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453
  return s - Math.floor(s)
}
function smooth (t) { return t * t * (3 - 2 * t) }
function valueNoise (x, y, z) {
  const xi = Math.floor(x); const yi = Math.floor(y); const zi = Math.floor(z)
  const xf = smooth(x - xi); const yf = smooth(y - yi); const zf = smooth(z - zi)
  const L = (a, b, t) => a + (b - a) * t
  const c = (dx, dy, dz) => hash(xi + dx, yi + dy, zi + dz)
  return L(
    L(L(c(0, 0, 0), c(1, 0, 0), xf), L(c(0, 1, 0), c(1, 1, 0), xf), yf),
    L(L(c(0, 0, 1), c(1, 0, 1), xf), L(c(0, 1, 1), c(1, 1, 1), xf), yf),
    zf) * 2 - 1
}
export function fbm (v, seed = 0) {
  let a = 0.5; let f = 1.2; let s = 0
  for (let i = 0; i < 4; i++) {
    s += a * valueNoise(v.x * f + seed, v.y * f + seed * 2, v.z * f - seed)
    a *= 0.5; f *= 2
  }
  return s
}

export function latLonToDir (lat, lon) {
  const phi = THREE.MathUtils.degToRad(90 - lat)
  const theta = THREE.MathUtils.degToRad(lon)
  return new THREE.Vector3(Math.sin(phi) * Math.sin(theta), Math.cos(phi), Math.sin(phi) * Math.cos(theta))
}

// Altura del terreno (0 = nivel del mar) para una dirección unitaria
export function terrainHeight (dir, world) {
  const n = fbm(dir, world.seed || 0) + (world.landBias ?? 0.08)
  return n > 0 ? n * 0.6 : 0
}

export function buildPlanet (world) {
  const r = world.radius
  const geo = new THREE.IcosahedronGeometry(1, r > 3 ? 20 : 9)
  const pos = geo.attributes.position
  const colors = new Float32Array(pos.count * 3)
  const c = world.colors
  const pal = {
    deep: new THREE.Color(c.deep), sea: new THREE.Color(c.sea), sand: new THREE.Color(c.sand),
    land: new THREE.Color(c.land), hill: new THREE.Color(c.hill), peak: new THREE.Color(c.peak)
  }
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize()
    const h = terrainHeight(v, world)
    v.multiplyScalar(r * (1 + h * 0.12))
    pos.setXYZ(i, v.x, v.y, v.z)
  }
  // color por cara (centroide) para el aspecto facetado
  const a = new THREE.Vector3(); const b = new THREE.Vector3(); const d = new THREE.Vector3()
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); d.fromBufferAttribute(pos, i + 2)
    const cen = a.add(b).add(d).divideScalar(3).normalize()
    const n = fbm(cen, world.seed || 0) + (world.landBias ?? 0.08)
    const pole = Math.abs(cen.y) > 0.9
    const col = pole ? pal.peak
      : n < -0.12 ? pal.deep
        : n < 0 ? pal.sea
          : n < 0.05 ? pal.sand
            : n < 0.2 ? pal.land
              : n < 0.33 ? pal.hill : pal.peak
    for (let k = 0; k < 3; k++) col.toArray(colors, (i + k) * 3)
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geo.computeVertexNormals()
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }))
  mesh.receiveShadow = true
  return mesh
}

export function surfacePoint (world, lat, lon, lift = 0) {
  const dir = latLonToDir(lat, lon)
  const h = terrainHeight(dir, world)
  return dir.multiplyScalar(world.radius * (1 + h * 0.12) + lift)
}

// Puntos intermedios sobre la esfera entre dos direcciones (para el modo dados)
export function greatCirclePoints (fromDir, toDir, count) {
  const pts = []
  const q0 = new THREE.Quaternion()
  const qFull = new THREE.Quaternion().setFromUnitVectors(fromDir.clone().normalize(), toDir.clone().normalize())
  for (let i = 1; i <= count; i++) {
    const q = q0.clone().slerp(qFull, i / count)
    pts.push(fromDir.clone().normalize().applyQuaternion(q))
  }
  return pts
}

export function starfield (count = 400) {
  const geo = new THREE.BufferGeometry()
  const arr = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(40 + Math.random() * 20)
    v.toArray(arr, i * 3)
  }
  geo.setAttribute('position', new THREE.BufferAttribute(arr, 3))
  return new THREE.Points(geo, new THREE.PointsMaterial({ color: '#ffffff', size: 1.5, sizeAttenuation: false }))
}

// ============================================================ CHIPTUNE

const NOTE_INDEX = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 }

export function noteToFreq (note) {
  const m = /^([A-G]#?)(\d)$/.exec(note)
  if (!m) return null
  const midi = (Number(m[2]) + 1) * 12 + NOTE_INDEX[m[1]]
  return 440 * Math.pow(2, (midi - 69) / 12)
}

// Convierte 'C5 - E5 .' en [{freq, len}, null, ...] (un evento por paso)
export function parsePattern (str = '') {
  const tokens = str.trim().split(/\s+/).filter(Boolean)
  const events = new Array(tokens.length).fill(null)
  tokens.forEach((t, i) => {
    if (t === '-' || t === '.') return
    let len = 1
    while (tokens[i + len] === '-') len++
    events[i] = { token: t, freq: noteToFreq(t), len }
  })
  return events
}

class Chiptune {
  constructor () {
    this.ctx = null
    this.master = null
    this.volume = 0.5
    this.current = null
    this.timer = null
  }

  ensure () {
    if (this.ctx) return true
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext
    if (!AC) return false
    this.ctx = new AC()
    this.master = this.ctx.createGain()
    this.master.gain.value = this.volume * 0.35
    this.master.connect(this.ctx.destination)
    // Onda cuadrada con ciclo de trabajo 25% (sonido "NES")
    const n = 32
    const real = new Float32Array(n)
    const imag = new Float32Array(n)
    for (let k = 1; k < n; k++) imag[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * 0.25)
    this.pulse = this.ctx.createPeriodicWave(real, imag)
    const len = this.ctx.sampleRate
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
    const data = this.noise.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    return true
  }

  setVolume (v) {
    this.volume = v
    if (this.master) this.master.gain.value = v * 0.35
  }

  resume () {
    if (this.ensure() && this.ctx.state === 'suspended') this.ctx.resume()
  }

  play (trackId) {
    if (this.current?.id === trackId) return
    this.stop()
    const track = TRACKS[trackId]
    if (!track || !this.ensure()) return
    const channels = {
      lead: parsePattern(track.lead),
      bass: parsePattern(track.bass),
      drums: (track.drums || '').trim().split(/\s+/)
    }
    const steps = Math.max(channels.lead.length, channels.bass.length)
    const stepDur = 60 / track.bpm / 2
    this.current = { id: trackId, track, channels, steps, stepDur, step: 0, next: this.ctx.currentTime + 0.05 }
    this.timer = setInterval(() => this.schedule(), 25)
  }

  stop () {
    clearInterval(this.timer)
    this.timer = null
    this.current = null
  }

  schedule () {
    const c = this.current
    if (!c) return
    while (c.next < this.ctx.currentTime + 0.12) {
      if (c.track.once && c.step >= c.steps) { this.stop(); return }
      const i = c.step % c.steps
      const lead = c.channels.lead[i % c.channels.lead.length]
      const bass = c.channels.bass[i % c.channels.bass.length]
      const drum = c.channels.drums[i % c.channels.drums.length]
      if (lead?.freq) this.tone('pulse', lead.freq, c.next, lead.len * c.stepDur, 0.22)
      if (bass?.freq) this.tone('triangle', bass.freq, c.next, bass.len * c.stepDur, 0.4)
      if (drum && drum !== '.') this.drum(drum, c.next)
      c.step++
      c.next += c.stepDur
    }
  }

  tone (type, freq, t, dur, vol) {
    const osc = this.ctx.createOscillator()
    if (type === 'pulse') osc.setPeriodicWave(this.pulse)
    else osc.type = type
    osc.frequency.value = freq
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(vol, t)
    g.gain.setValueAtTime(vol, t + Math.max(0.01, dur - 0.03))
    g.gain.linearRampToValueAtTime(0, t + dur)
    osc.connect(g).connect(this.master)
    osc.start(t)
    osc.stop(t + dur + 0.01)
  }

  drum (kind, t) {
    if (kind === 'k') {
      const osc = this.ctx.createOscillator()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(150, t)
      osc.frequency.exponentialRampToValueAtTime(40, t + 0.12)
      const g = this.ctx.createGain()
      g.gain.setValueAtTime(0.7, t)
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.15)
      osc.connect(g).connect(this.master)
      osc.start(t)
      osc.stop(t + 0.16)
      return
    }
    const src = this.ctx.createBufferSource()
    src.buffer = this.noise
    const f = this.ctx.createBiquadFilter()
    f.type = kind === 'h' ? 'highpass' : 'bandpass'
    f.frequency.value = kind === 'h' ? 7000 : 1800
    const g = this.ctx.createGain()
    const len = kind === 'h' ? 0.04 : 0.12
    g.gain.setValueAtTime(kind === 'h' ? 0.15 : 0.35, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + len)
    src.connect(f).connect(g).connect(this.master)
    src.start(t, Math.random() * 0.5)
    src.stop(t + len)
  }

  // Efectos cortos (pasos, recoger objeto, acierto/error)
  sfx (name) {
    if (!this.ensure()) return
    const t = this.ctx.currentTime
    const seqs = {
      step: [['C6', 0.03]],
      coin: [['B5', 0.06], ['E6', 0.14]],
      ok: [['C5', 0.06], ['E5', 0.06], ['G5', 0.1]],
      bad: [['E4', 0.08], ['C4', 0.16]],
      dice: [['G5', 0.03], ['A5', 0.03], ['B5', 0.03], ['D6', 0.06]],
      talk: [['A5', 0.02]]
    }
    let at = t
    for (const [n, d] of seqs[name] || []) {
      this.tone('pulse', noteToFreq(n), at, d, 0.15)
      at += d
    }
  }
}

export const chiptune = new Chiptune()

// ============================================================ LÓGICA DE MISIONES

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
