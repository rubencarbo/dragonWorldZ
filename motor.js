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
export function createRetroRenderer (container, { pixelSize = 2, alpha = false } = {}) {
  // a resolución nativa se activa el antialiasing (bordes suaves); en modo retro no
  const renderer = new THREE.WebGLRenderer({ antialias: pixelSize <= 1, alpha, powerPreference: 'high-performance' })
  renderer.setPixelRatio(1)
  if (alpha) renderer.setClearColor(0x000000, 0)
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
  // iOS Safari: sin esto, el pellizco amplía la página entera en vez del mapa
  const block = e => { if (e.touches ? e.touches.length > 1 : true) e.preventDefault() }
  canvas.addEventListener('pointerdown', down)
  canvas.addEventListener('pointermove', move)
  canvas.addEventListener('pointerup', up)
  canvas.addEventListener('pointercancel', up)
  canvas.addEventListener('wheel', wheel, { passive: false })
  canvas.addEventListener('touchmove', block, { passive: false })
  canvas.addEventListener('gesturestart', block)
  canvas.addEventListener('gesturechange', block)
  return () => {
    canvas.removeEventListener('pointerdown', down)
    canvas.removeEventListener('pointermove', move)
    canvas.removeEventListener('pointerup', up)
    canvas.removeEventListener('pointercancel', up)
    canvas.removeEventListener('wheel', wheel)
    canvas.removeEventListener('touchmove', block)
    canvas.removeEventListener('gesturestart', block)
    canvas.removeEventListener('gesturechange', block)
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
  // un bloque por píxel, estirado en profundidad (sprites grandes = pocas instancias)
  const group = new THREE.Group()
  const mesh = new THREE.InstancedMesh(box, new THREE.MeshLambertMaterial(), cells.length)
  const m = new THREE.Matrix4()
  const c = new THREE.Color()
  cells.forEach((cell, i) => {
    m.makeScale(size, size, size * depth)
    m.setPosition((cell.x - w / 2 + 0.5) * size, (cell.y + 0.5) * size, 0)
    mesh.setMatrixAt(i, m)
    mesh.setColorAt(i, c.set(cell.color))
  })
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

// Extrae un sprite pixel-art de una imagen (captura, sprite escalado, JPG...):
//   1. detecta el tamaño del "píxel artístico" y su desfase (rejilla original)
//   2. toma el color central de cada celda
//   3. quita el fondo rellenando desde los bordes (el contorno oscuro lo frena)
//   4. reduce la paleta para eliminar ruido de compresión
// opts: box [x0,y0,x1,y1] · cell (forzar tamaño) · keep [[x,y]...] polígono a
// conservar (para separar sprites solapados) · tol (tolerancia de fondo) ·
// maxColors · recolor [[desde, hacia, tolerancia]]
export function extractSprite (img, opts = {}) {
  const [x0, y0, x1, y1] = opts.box || [0, 0, img.naturalWidth || img.width, img.naturalHeight || img.height]
  const W = Math.round(x1 - x0)
  const H = Math.round(y1 - y0)
  const cv = document.createElement('canvas')
  cv.width = W; cv.height = H
  const ctx = cv.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(img, x0, y0, W, H, 0, 0, W, H)
  const d = ctx.getImageData(0, 0, W, H).data
  const at = (x, y) => { const i = (y * W + x) * 4; return [d[i], d[i + 1], d[i + 2], d[i + 3]] }
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

  // 1) rejilla: bordes fuertes por columna/fila y periodo que mejor los explica
  const colE = new Float32Array(W); const rowE = new Float32Array(H)
  for (let y = 0; y < H; y++) {
    for (let x = 1; x < W; x++) { const e = dist(at(x, y), at(x - 1, y)); if (e > 40) colE[x] += 1 }
  }
  for (let x = 0; x < W; x++) {
    for (let y = 1; y < H; y++) { const e = dist(at(x, y), at(x, y - 1)); if (e > 40) rowE[y] += 1 }
  }
  const fit = (E, n, forced) => {
    const scores = []
    const candidates = forced ? [forced] : Array.from({ length: 131 }, (_, i) => 1.5 + i * 0.05)
    for (const s of candidates) {
      let best = { score: -1, off: 0 }
      for (let off = 0; off < s; off += 0.25) {
        let sum = 0; let cnt = 0
        for (let p = off; p < n; p += s) { const i = Math.round(p); if (i > 0 && i < n) { sum += E[i]; cnt++ } }
        const score = cnt ? sum / cnt : 0
        if (score > best.score) best = { score, off }
      }
      scores.push({ s, ...best })
    }
    const max = Math.max(...scores.map(o => o.score))
    // el menor periodo casi óptimo (los múltiplos puntúan igual)
    return scores.find(o => o.score >= max * 0.92)
  }
  const gx = fit(colE, W, opts.cell)
  const gy = fit(rowE, H, opts.cell || gx.s)
  const s = opts.cell || (gx.s + gy.s) / 2
  const cols = Math.floor((W - gx.off) / s)
  const rows = Math.floor((H - gy.off) / s)

  // 2) color de cada celda: mediana del centro
  const inPoly = (px, py, poly) => {
    let inside = false
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i]; const [xj, yj] = poly[j]
      if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside
    }
    return inside
  }
  const cells = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = gx.off + (c + 0.5) * s; const cy = gy.off + (r + 0.5) * s
      if (opts.keep && !inPoly(cx + x0, cy + y0, opts.keep)) { cells.push(null); continue }
      const samples = []
      const k = Math.max(0, Math.floor(s * 0.25))
      for (let dy = -k; dy <= k; dy++) {
        for (let dx = -k; dx <= k; dx++) {
          const px = Math.min(W - 1, Math.max(0, Math.round(cx + dx))); const py = Math.min(H - 1, Math.max(0, Math.round(cy + dy)))
          samples.push(at(px, py))
        }
      }
      if (samples.filter(p => p[3] > 128).length < samples.length / 2) { cells.push(null); continue }
      const med = [0, 1, 2].map(ch => samples.map(p => p[ch]).sort((a, b) => a - b)[samples.length >> 1])
      cells.push(med)
    }
  }

  // 3) fondo: relleno desde los bordes con colores parecidos a sus vecinos,
  //    sin atravesar colores oscuros (contornos)
  const tol = opts.tol ?? 38
  const lum = p => 0.3 * p[0] + 0.59 * p[1] + 0.11 * p[2]
  // color de fondo de referencia: mediana del borde del recorte
  const border = []
  for (let x = 0; x < W; x += 2) { border.push(at(x, 0), at(x, H - 1)) }
  for (let y = 0; y < H; y += 2) { border.push(at(0, y), at(W - 1, y)) }
  const bgRef = [0, 1, 2].map(ch => border.map(p => p[ch]).sort((a, b) => a - b)[border.length >> 1])
  const bg = new Uint8Array(rows * cols)
  const queue = []
  const seed = (r, c) => { const i = r * cols + c; if (!bg[i]) { bg[i] = 1; queue.push(i) } }
  for (let c = 0; c < cols; c++) { seed(0, c); seed(rows - 1, c) }
  for (let r = 0; r < rows; r++) { seed(r, 0); seed(r, cols - 1) }
  while (queue.length) {
    const i = queue.pop()
    const r = Math.floor(i / cols); const c = i % cols
    const p = cells[i]
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nr = r + dr; const nc = c + dc
      if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue
      const j = nr * cols + nc
      if (bg[j]) continue
      const q = cells[j]
      // parecido al vecino de fondo, o muy claro (brillos, lunas, auras): sigue siendo fondo
      if (!q || (p && dist(p, q) < tol && lum(q) > 70) || (!p && dist(q, bgRef) < tol * 1.6) || (opts.bright !== false && lum(q) > (opts.brightLum ?? 200))) { bg[j] = 1; queue.push(j) }
    }
  }
  // huecos cerrados (entre brazo y cuerpo) con el color del fondo
  const bgSamples = []
  cells.forEach((p, i) => { if (p && bg[i] && bgSamples.length < 400 && (i % 7 === 0)) bgSamples.push(p) })
  cells.forEach((p, i) => {
    if (!p || bg[i] || lum(p) < 70) return
    if (bgSamples.some(b => dist(b, p) < (opts.pocketTol ?? 22))) bg[i] = 1
  })
  // islas sueltas (restos de fondo o de otros sprites): solo se queda lo grande
  {
    const comp = new Int32Array(rows * cols).fill(-1)
    const sizes = []
    for (let i = 0; i < rows * cols; i++) {
      if (bg[i] || !cells[i] || comp[i] >= 0) continue
      const id = sizes.length; let n = 0; const st = [i]; comp[i] = id
      while (st.length) {
        const k = st.pop(); n++
        const r = Math.floor(k / cols); const c = k % cols
        for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nr = r + dr; const nc = c + dc
          if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue
          const j = nr * cols + nc
          if (!bg[j] && cells[j] && comp[j] < 0) { comp[j] = id; st.push(j) }
        }
      }
      sizes.push(n)
    }
    const big = Math.max(0, ...sizes)
    for (let i = 0; i < rows * cols; i++) if (comp[i] >= 0 && sizes[comp[i]] < big * (opts.minIsland ?? 0.04)) bg[i] = 1
  }

  // 4) paleta reducida
  let fg = []
  cells.forEach((p, i) => { if (p && !bg[i]) fg.push(p) })
  if (opts.recolor) {
    cells.forEach((p, i) => {
      if (!p || bg[i]) return
      for (const [from, to, t = 60] of opts.recolor) {
        const f = hexToRgb(from)
        if (dist(p, f) < t) { const tt = hexToRgb(to); cells[i] = [0, 1, 2].map(ch => Math.max(0, Math.min(255, p[ch] - f[ch] + tt[ch]))); break }
      }
    })
    fg = cells.filter((p, i) => p && !bg[i])
  }
  const centers = quantize(fg, opts.maxColors || 20)
  const KEYS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const palette = {}
  centers.forEach((c, i) => { palette[KEYS[i]] = rgbToHex(c) })
  let grid = []
  for (let r = 0; r < rows; r++) {
    let row = ''
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c
      row += cells[i] && !bg[i] ? KEYS[nearest(centers, cells[i])] : '.'
    }
    grid.push(row)
  }
  // recorte de márgenes vacíos
  const used = grid.map(r => r.search(/[^.]/))
  const top = used.findIndex(v => v >= 0)
  const bottom = used.length - 1 - [...used].reverse().findIndex(v => v >= 0)
  grid = grid.slice(top, bottom + 1)
  const left = Math.min(...grid.map(r => { const i = r.search(/[^.]/); return i < 0 ? Infinity : i }))
  const right = Math.max(...grid.map(r => r.replace(/\.+$/, '').length))
  grid = grid.map(r => r.slice(left, right))
  return { grid, palette, cell: s }
}

function hexToRgb (hex) {
  const n = parseInt(hex.slice(1), 16)
  return [n >> 16, (n >> 8) & 255, n & 255]
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
  // `ref`: altura de referencia; así un personaje bajo (Krilin) sale más bajo que Goku
  const rows = sprite.ref || CHARACTERS[id]?.ref || sprite.grid.length
  const voxel = (16 * size) / rows
  // lámina fina: con más grosor, desde arriba se verían las caras superiores del contorno
  return spriteToVoxels(sprite.grid, palette, { size: voxel, depth: Math.max(1.5, rows / 18) })
}

// datos del sprite (personalizado si existe) para dibujarlo en 2D (retratos)
export function spriteData (id) {
  return customSprites[id] || CHARACTERS[id] || null
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
    case 'npc': return characterModel(prop.sprite, 0.078)
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
    case 'turtle': { // Umigame: caparazón marrón, cabeza y aletas verdes
      const g = blocks([
        [0, 0.05, 0, 0.62, 0.22, 0.5, '#8a5a2a'],
        [0, 0.27, 0, 0.46, 0.12, 0.36, '#6a4220'],
        [0.38, 0.12, 0, 0.2, 0.16, 0.18, '#7cc35a'],
        [0.5, 0.2, 0, 0.14, 0.12, 0.14, '#7cc35a'],
        [-0.12, 0, 0.26, 0.16, 0.06, 0.12, '#7cc35a'], [-0.12, 0, -0.26, 0.16, 0.06, 0.12, '#7cc35a'],
        [0.2, 0, 0.26, 0.16, 0.06, 0.12, '#7cc35a'], [0.2, 0, -0.26, 0.16, 0.06, 0.12, '#7cc35a'],
        [0.56, 0.24, 0.05, 0.03, 0.03, 0.03, '#15151f']
      ])
      g.rotation.y = Math.PI / 4
      return g
    }
    case 'fishspot': return blocks([ // poza con caña y un pez saltando
      [0, 0, 0, 0.6, 0.04, 0.6, '#5fb2f0'],
      [-0.2, 0, -0.2, 0.05, 0.9, 0.05, '#8a5a2a'],
      [0.12, 0.35, 0.1, 0.28, 0.12, 0.08, '#ff9a4a'],
      [0.28, 0.36, 0.1, 0.08, 0.16, 0.04, '#ff9a4a']
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

// ============================================================ DIORAMA (globo estilo maqueta)
// El mundo se muestra como una maqueta: planeta de piezas con carretera, árboles,
// flores y casas, sobre una peana con nubes y placa con el nombre.
// Tres estilos gráficos comparten la misma escena:
//   bricks → piezas de construcción (studs, plástico brillante)
//   toon   → dibujo animado (sombreado plano por bandas y contorno)
//   pixel  → pixel-art (texturas sin suavizar, render a baja resolución)
export const VISUAL_STYLES = {
  bricks: { name: 'Bloques de construcción', short: 'Bloques' },
  toon: { name: 'Dibujo animado', short: 'Cartoon' },
  pixel: { name: 'Pixel-art retro', short: 'Pixel' }
}

function mulberry (seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

let toonRamp
function toonGradient () {
  if (toonRamp) return toonRamp
  toonRamp = new THREE.DataTexture(new Uint8Array([90, 170, 255]), 3, 1, THREE.RedFormat)
  toonRamp.minFilter = toonRamp.magFilter = THREE.NearestFilter
  toonRamp.needsUpdate = true
  return toonRamp
}

// material según el estilo
export function styleMat (style, opts = {}) {
  if (style === 'toon') return new THREE.MeshToonMaterial({ gradientMap: toonGradient(), ...opts })
  if (style === 'pixel') return new THREE.MeshLambertMaterial({ flatShading: true, ...opts })
  return new THREE.MeshStandardMaterial({ roughness: 0.38, metalness: 0, ...opts })
}

function canvasTex (canvas, style, { repeatX = 1 } = {}) {
  const t = new THREE.CanvasTexture(canvas)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  if (style === 'pixel') { t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false }
  if (repeatX !== 1) { t.wrapS = THREE.RepeatWrapping; t.repeat.x = repeatX }
  return t
}

function shadeCss (hex, k) {
  const c = new THREE.Color(hex)
  const hsl = {}
  c.getHSL(hsl)
  c.setHSL(hsl.h, hsl.s, THREE.MathUtils.clamp(hsl.l + k, 0, 1))
  return '#' + c.getHexString()
}

// tipo de terreno en una dirección del planeta
function biomeAt (dir, world) {
  const n = fbm(dir, world.seed || 0) + (world.landBias ?? 0.08)
  if (n < -0.12) return 'deep'
  if (n < 0) return 'sea'
  if (n < 0.04) return 'sand'
  if (n < 0.22) return 'land'
  return 'hill'
}

// textura del planeta: mosaico de piezas en coordenadas equirrectangulares,
// con el nº de piezas por fila ajustado a la latitud para que midan lo mismo
function planetTextures (world, style, maxSize) {
  const R = world.radius
  const tileWorld = (world.tileSize || 0.14) * (style === 'toon' ? 2.4 : style === 'pixel' ? 1.4 : 1)
  const around = Math.max(24, Math.round((2 * Math.PI * R) / tileWorld))
  const W = style === 'pixel' ? Math.min(maxSize, around * 8) : Math.min(maxSize, 4096)
  const H = W / 2
  const rows = Math.round(around / 2)
  const col = document.createElement('canvas'); col.width = W; col.height = H
  const bump = document.createElement('canvas'); bump.width = W; bump.height = H
  const g = col.getContext('2d')
  const b = bump.getContext('2d')
  b.fillStyle = '#000'; b.fillRect(0, 0, W, H)
  const rnd = mulberry((world.seed || 0) * 977 + 13)
  const c = world.colors
  const th = H / rows
  for (let r = 0; r < rows; r++) {
    const latC = 90 - (r + 0.5) * (180 / rows)
    const n = Math.max(3, Math.round(around * Math.cos(THREE.MathUtils.degToRad(latC))))
    const tw = W / n
    for (let i = 0; i < n; i++) {
      // u de la textura → longitud (convención de SphereGeometry)
      const lon = ((i + 0.5) / n) * 360 - 90
      const kind = biomeAt(latLonToDir(latC, lon), world)
      let base = { deep: c.deep, sea: c.sea, sand: c.sand, land: c.land, hill: c.hill }[kind]
      if (kind === 'land' && rnd() < 0.3) base = c.hill
      const jitter = style === 'toon' ? (rnd() - 0.5) * 0.04 : (rnd() - 0.5) * 0.09 - (rnd() < 0.08 ? 0.06 : 0)
      const fill = shadeCss(base, jitter)
      const x = i * tw; const y = r * th
      g.fillStyle = fill
      g.fillRect(Math.floor(x), Math.floor(y), Math.ceil(tw) + 1, Math.ceil(th) + 1)
      if (style !== 'toon') {
        // junta entre piezas
        g.fillStyle = 'rgba(0,0,0,0.13)'
        g.fillRect(Math.floor(x), Math.floor(y), Math.ceil(tw), Math.max(1, th * 0.05))
        g.fillRect(Math.floor(x), Math.floor(y), Math.max(1, tw * 0.05), Math.ceil(th))
        b.fillStyle = '#222'
        b.fillRect(Math.floor(x), Math.floor(y), Math.ceil(tw), Math.max(1, th * 0.06))
        b.fillRect(Math.floor(x), Math.floor(y), Math.max(1, tw * 0.06), Math.ceil(th))
      }
      const studP = kind === 'deep' || kind === 'sea' ? 0.14 : 0.42
      if (style === 'bricks' && rnd() < studP && Math.abs(latC) < 80) {
        const cx = x + tw / 2; const cy = y + th / 2
        const rr = Math.min(tw, th) * 0.3
        g.fillStyle = 'rgba(0,0,0,0.22)'
        g.beginPath(); g.ellipse(cx + rr * 0.18, cy + rr * 0.22, rr, rr, 0, 0, Math.PI * 2); g.fill()
        g.fillStyle = shadeCss(fill, 0.05)
        g.beginPath(); g.arc(cx, cy, rr, 0, Math.PI * 2); g.fill()
        g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = Math.max(1, rr * 0.22)
        g.beginPath(); g.arc(cx, cy, rr * 0.7, Math.PI * 1.05, Math.PI * 1.6); g.stroke()
        b.fillStyle = '#fff'
        b.beginPath(); b.arc(cx, cy, rr, 0, Math.PI * 2); b.fill()
      }
    }
  }
  return { map: canvasTex(col, style), bumpMap: style === 'bricks' ? canvasTex(bump, style) : null }
}

function roadTexture (style) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 64
  const g = cv.getContext('2d')
  g.fillStyle = '#f3f3f1'; g.fillRect(0, 0, 512, 64)
  if (style !== 'toon') {
    g.fillStyle = 'rgba(0,0,0,0.10)'
    for (let x = 0; x < 512; x += 32) g.fillRect(x, 0, 2, 64)
    g.fillRect(0, 31, 512, 2)
  }
  g.fillStyle = '#d4d4d0'; g.fillRect(0, 0, 512, 5); g.fillRect(0, 59, 512, 5)
  return cv
}

// orienta un objeto sobre la superficie: su +Y apunta hacia fuera
function placeOn (obj, dir, radius, spin = 0) {
  obj.position.copy(dir).multiplyScalar(radius)
  obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)
  if (spin) obj.rotateY(spin)
  return obj
}

// Árbol de copa redonda (racimos de bolas, como en la maqueta)
function treeParts (rnd) {
  const blobs = [[0, 0.62, 0, 0.24]]
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + rnd() * 0.5
    blobs.push([Math.cos(a) * 0.2, 0.5 + rnd() * 0.08, Math.sin(a) * 0.2, 0.15 + rnd() * 0.04])
  }
  blobs.push([0.05, 0.8, 0.02, 0.15])
  return blobs
}

export function buildDiorama (world, style = 'bricks') {
  const R = world.radius
  const S = world.decoScale || 0.45 // tamaño de la decoración
  const rnd = mulberry((world.seed || 0) * 31 + 7)
  const maxTex = 4096
  const planet = new THREE.Group()

  // --- esfera
  const tex = planetTextures(world, style, maxTex)
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(R, style === 'pixel' ? 48 : 128, style === 'pixel' ? 32 : 96),
    styleMat(style, { map: tex.map, ...(tex.bumpMap ? { bumpMap: tex.bumpMap, bumpScale: 1.2 } : {}) })
  )
  sphere.receiveShadow = true
  planet.add(sphere)

  // --- carretera blanca que rodea el planeta
  const axis = new THREE.Vector3(...(world.roadAxis || [0.35, 1, 0.15])).normalize()
  const roadW = (world.roadWidth || 0.42) / R // semiancho angular
  const road = new THREE.Group()
  const band = new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.008, 256, 3, 0, Math.PI * 2, Math.PI / 2 - roadW, roadW * 2),
    styleMat(style, { map: canvasTex(roadTexture(style), style, { repeatX: Math.max(4, Math.round(2 * Math.PI * R / 0.6)) }) })
  )
  road.add(band)
  for (const side of [-1, 1]) {
    const rr = R * 1.008
    const curb = new THREE.Mesh(new THREE.TorusGeometry(rr * Math.cos(roadW), R * 0.012, 6, 192), styleMat(style, { color: '#d9d9d6' }))
    curb.rotation.x = Math.PI / 2
    curb.position.y = side * rr * Math.sin(roadW)
    road.add(curb)
  }
  road.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis)
  planet.add(road)
  const onRoad = dir => Math.abs(dir.dot(axis)) < Math.sin(roadW * 1.6)

  // puntos reservados (lugares) donde no se ponen árboles
  const reserved = (world.locations || []).map(l => latLonToDir(l.lat, l.lon))
  const free = (dir, gap) => !onRoad(dir) && reserved.every(r => r.angleTo(dir) > gap)
  const isLand = dir => ['land', 'hill', 'sand'].includes(biomeAt(dir, world))

  // --- árboles (una sola malla instanciada para las copas y otra para troncos)
  const treeCount = world.trees ?? Math.round(R * R * 1.6)
  const trees = []
  for (let tries = 0; trees.length < treeCount && tries < treeCount * 40; tries++) {
    const dir = new THREE.Vector3().randomDirection()
    if (!isLand(dir) || biomeAt(dir, world) === 'sand' || !free(dir, 0.3 * (5 / R))) continue
    if (trees.some(t => t.dir.angleTo(dir) < 0.12 * (5 / R))) continue
    trees.push({ dir, s: S * (world.treeScale || 1) * (0.75 + rnd() * 0.6), parts: treeParts(rnd), spin: rnd() * 6.28 })
  }
  const blobGeo = style === 'pixel' ? new THREE.BoxGeometry(1.6, 1.6, 1.6) : style === 'toon' ? new THREE.SphereGeometry(1, 16, 12) : new THREE.IcosahedronGeometry(1, 1)
  const leaves = new THREE.InstancedMesh(blobGeo, styleMat(style, { flatShading: style !== 'toon' }), trees.reduce((a, t) => a + t.parts.length, 0))
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.05, 0.07, 0.5, 8), styleMat(style, { color: '#7a4a22' }), trees.length)
  const greens = ['#2e8b3a', '#3aa047', '#4cb552', '#2a7a34']
  const m = new THREE.Matrix4(); const q = new THREE.Quaternion(); const col = new THREE.Color()
  let li = 0
  trees.forEach((t, ti) => {
    const base = new THREE.Object3D()
    placeOn(base, t.dir, R, t.spin)
    base.scale.setScalar(t.s)
    base.updateMatrix()
    m.makeTranslation(0, 0.25, 0); trunks.setMatrixAt(ti, base.matrix.clone().multiply(m))
    const tint = greens[Math.floor(rnd() * greens.length)]
    for (const [x, y, z, r] of t.parts) {
      m.compose(new THREE.Vector3(x, y, z), q.identity(), new THREE.Vector3(r, r, r))
      leaves.setMatrixAt(li, base.matrix.clone().multiply(m))
      leaves.setColorAt(li++, col.set(shadeCss(tint, (rnd() - 0.5) * 0.08)))
    }
  })
  leaves.castShadow = trunks.castShadow = true
  planet.add(leaves, trunks)

  // --- flores y matas
  const flowerN = world.flowers ?? Math.round(R * R * 5)
  const petals = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.045, 0.045, 0.02, style === 'pixel' ? 4 : 10), styleMat(style), flowerN)
  const cores = new THREE.InstancedMesh(new THREE.SphereGeometry(0.02, 6, 4), styleMat(style, { color: '#f6b21c' }), flowerN)
  const tufts = new THREE.InstancedMesh(new THREE.ConeGeometry(0.05, 0.12, 5), styleMat(style, { color: '#3f9e3a' }), flowerN)
  let fi = 0
  for (let tries = 0; fi < flowerN && tries < flowerN * 30; tries++) {
    const dir = new THREE.Vector3().randomDirection()
    if (!isLand(dir) || !free(dir, 0.12 * (5 / R))) continue
    const o = placeOn(new THREE.Object3D(), dir, R * 1.002)
    o.scale.setScalar(S * 1.4)
    o.updateMatrix()
    petals.setMatrixAt(fi, o.matrix)
    petals.setColorAt(fi, col.set(rnd() < 0.6 ? '#ffffff' : '#ffe14a'))
    m.makeTranslation(0, 0.015, 0); cores.setMatrixAt(fi, o.matrix.clone().multiply(m))
    m.makeTranslation(0.09, 0.05, 0.04); tufts.setMatrixAt(fi, o.matrix.clone().multiply(m))
    fi++
  }
  petals.count = cores.count = tufts.count = fi
  planet.add(petals, cores, tufts)

  // --- peana fija (no gira con el planeta): nubes, pilares, base y placa.
  // Solo en los mundos que la piden (el planeta de Kaio, réplica de la maqueta)
  const stand = new THREE.Group()
  if (world.stand) {
  const baseY = -R * 1.62
  const white = styleMat(style, { color: '#fbfbfb' })
  const cloudGeo = style === 'pixel' ? new THREE.BoxGeometry(1.6, 1.6, 1.6) : new THREE.SphereGeometry(1, 20, 14)
  const clouds = new THREE.InstancedMesh(cloudGeo, white, 46)
  for (let i = 0; i < 46; i++) {
    const a = (i / 46) * Math.PI * 2 + rnd() * 0.3
    const rad = R * (0.35 + rnd() * 0.55)
    const r = R * (0.11 + rnd() * 0.1)
    m.compose(new THREE.Vector3(Math.cos(a) * rad, -R * 1.18 + rnd() * R * 0.12, Math.sin(a) * rad), q.identity(), new THREE.Vector3(r * 1.2, r * 0.75, r))
    clouds.setMatrixAt(i, m)
  }
  stand.add(clouds)
  const glass = new THREE.MeshStandardMaterial({ color: '#dff4ff', transparent: true, opacity: 0.35, roughness: 0.1 })
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4
    const pil = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.035, R * 0.035, R * 0.42, 12), glass)
    pil.position.set(Math.cos(a) * R * 0.42, baseY + R * 0.28, Math.sin(a) * R * 0.42)
    stand.add(pil)
  }
  const base = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.92, R * 1.0, R * 0.16, 64), styleMat(style, { color: '#1d1b24' }))
  base.position.y = baseY
  stand.add(base)
  for (const [yy, rr] of [[baseY + R * 0.08, R * 0.92], [baseY - R * 0.08, R * 1.0]]) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(rr, R * 0.018, 8, 96), styleMat(style, { color: '#c9a24a', ...(style === 'bricks' ? { metalness: 0.6, roughness: 0.3 } : {}) }))
    rim.rotation.x = Math.PI / 2
    rim.position.y = yy
    stand.add(rim)
  }
  // placa con el nombre del mundo
  const pc = document.createElement('canvas'); pc.width = 1024; pc.height = 256
  const pg = pc.getContext('2d')
  pg.fillStyle = '#15131b'; pg.fillRect(0, 0, 1024, 256)
  pg.strokeStyle = '#c9a24a'; pg.lineWidth = 10; pg.strokeRect(14, 14, 996, 228)
  pg.fillStyle = '#e9d9a6'; pg.font = 'bold 84px Georgia, serif'; pg.textAlign = 'center'; pg.textBaseline = 'middle'
  pg.fillText((world.plaque || world.name).toUpperCase(), 512, 110)
  pg.fillStyle = '#ff9a1f'; pg.beginPath(); pg.arc(512, 200, 26, 0, Math.PI * 2); pg.fill()
  pg.fillStyle = '#d6333a'; pg.font = 'bold 30px sans-serif'; pg.fillText('★', 512, 201)
  const plaque = new THREE.Mesh(new THREE.BoxGeometry(R * 1.05, R * 0.26, R * 0.03),
    [...Array(4).fill(styleMat(style, { color: '#15131b' })), styleMat(style, { map: canvasTex(pc, style) }), styleMat(style, { color: '#15131b' })])
  plaque.position.set(0, baseY, R * 0.99)
  plaque.rotation.x = -0.05
  stand.add(plaque)

  }

  // --- Camino de la Serpiente (solo en los mundos que lo tienen)
  if (world.snakeWay) {
    const pts = []
    for (let i = 0; i <= 40; i++) {
      const t = i / 40
      const a = Math.PI * 0.75 + t * Math.PI * 1.9
      const rad = R * (1.02 - 0.22 * t)
      pts.push(new THREE.Vector3(Math.cos(a) * rad, baseY + R * 0.18 + t * R * 0.95, Math.sin(a) * rad))
    }
    const curve = new THREE.CatmullRomCurve3(pts)
    const segN = 110
    const segs = new THREE.InstancedMesh(new THREE.BoxGeometry(R * 0.13, R * 0.045, R * 0.075), styleMat(style), segN)
    const o = new THREE.Object3D()
    for (let i = 0; i < segN; i++) {
      const t = i / (segN - 1)
      o.position.copy(curve.getPointAt(t))
      o.lookAt(o.position.clone().add(curve.getTangentAt(t)))
      o.rotateY(Math.PI / 2)
      o.updateMatrix()
      segs.setMatrixAt(i, o.matrix)
      segs.setColorAt(i, col.set(i % 2 ? '#f7f3e8' : '#e8e0cc'))
    }
    stand.add(segs)
  }

  // --- extras decorativos (coche, personajes...) repartidos por el planeta
  for (const ex of world.extras || []) {
    const model = extraModel(ex.kind, style)
    placeOn(model, latLonToDir(ex.lat, ex.lon), R, ex.spin || 0)
    model.scale.multiplyScalar(S * (ex.scale || 1))
    planet.add(model)
  }

  return {
    planet,
    stand,
    hasStand: Boolean(world.stand),
    sphere,
    radius: R,
    surface: (dir, lift = 0) => dir.clone().normalize().multiplyScalar(R + lift)
  }
}

// ------------------------------------------------------------ lugares emblemáticos
export function landmarkModel (kind, style = 'bricks') {
  const M = (color, extra) => styleMat(style, { color, ...extra })
  const g = new THREE.Group()
  const add = (geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, rz)
    mesh.castShadow = true
    g.add(mesh)
    return mesh
  }
  const seg = style === 'pixel' ? 8 : 32
  const dome = (r, x, z, colors) => {
    const [body, band, cap] = colors
    add(new THREE.CylinderGeometry(r, r * 1.02, r * 0.18, seg), M(shadeCss(body, -0.06)), x, r * 0.09, z)
    add(new THREE.SphereGeometry(r, seg, seg / 2, 0, Math.PI * 2, 0, Math.PI / 2), M(body), x, r * 0.18, z)
    const t = add(new THREE.TorusGeometry(r * 0.83, r * 0.06, 8, seg), M(band), x, r * 0.72, z, Math.PI / 2)
    t.scale.z = 1
    add(new THREE.SphereGeometry(r * 0.42, seg, seg / 2, 0, Math.PI * 2, 0, Math.PI / 2), M(cap), x, r * 0.9, z).scale.y = 0.55
  }
  const door = (x, y, z, h, color = '#8a5a2a', inner = '#3a5fa8', ry = 0) => {
    const d = new THREE.Group()
    const fr = new THREE.Mesh(new THREE.BoxGeometry(h * 0.62, h * 0.7, 0.05), M(color)); fr.position.y = h * 0.35
    const top = new THREE.Mesh(new THREE.CylinderGeometry(h * 0.31, h * 0.31, 0.05, 16, 1, false, -Math.PI / 2, Math.PI), M(color))
    top.rotation.x = Math.PI / 2; top.position.y = h * 0.7
    const inn = new THREE.Mesh(new THREE.BoxGeometry(h * 0.44, h * 0.62, 0.06), M(inner)); inn.position.y = h * 0.33
    d.add(fr, top, inn)
    d.position.set(x, y, z); d.rotation.y = ry
    g.add(d)
  }
  switch (kind) {
    case 'kaiohouse': {
      const cols = ['#f1d58c', '#b98a3c', '#fbfbf5']
      dome(0.55, 0, 0, cols)
      dome(0.34, 0.66, -0.12, cols)
      dome(0.28, -0.52, -0.42, cols)
      for (const x of [-0.08, 0.1]) {
        add(new THREE.CylinderGeometry(0.012, 0.012, 0.32, 6), M('#8a8a90'), x, 0.92, 0)
        add(new THREE.SphereGeometry(0.03, 8, 6), M('#9a9aa0'), x, 1.09, 0)
      }
      door(0, 0.02, 0.5, 0.42)
      door(0.68, 0.02, 0.2, 0.26, '#8a5a2a', '#6a3a1a', 0.3)
      for (const a of [-0.9, 0.8]) add(new THREE.SphereGeometry(0.07, 10, 8), M('#3a5fa8'), Math.sin(a) * 0.5, 0.36, Math.cos(a) * 0.5).scale.set(1.2, 0.8, 0.5)
      break
    }
    case 'dome': { // Capsule Corp
      dome(0.62, 0, 0, ['#f6f6f2', '#2d5bc2', '#fbfbf5'])
      dome(0.34, 0.7, -0.2, ['#f6f6f2', '#2d5bc2', '#fbfbf5'])
      door(0, 0.02, 0.56, 0.4, '#2d5bc2', '#9fd3ff')
      break
    }
    case 'cabin': { // casa del abuelo Gohan
      add(new THREE.CylinderGeometry(0.42, 0.46, 0.5, style === 'pixel' ? 8 : 24), M('#f0e0bc'), 0, 0.25, 0)
      add(new THREE.ConeGeometry(0.66, 0.42, style === 'pixel' ? 8 : 24), M('#c8412e'), 0, 0.7, 0)
      add(new THREE.SphereGeometry(0.07, 8, 6), M('#f6b21c'), 0, 0.94, 0)
      door(0, 0.01, 0.41, 0.34, '#8a5a2a', '#5a3414')
      add(new THREE.CylinderGeometry(0.08, 0.08, 0.02, 12), M('#9fd3ff'), 0.28, 0.32, 0.33, Math.PI / 2, 0, 0)
      break
    }
    case 'kamehouse': {
      add(new THREE.CylinderGeometry(0.75, 0.8, 0.12, seg), M('#ecd9a0'), 0, 0.06, 0)
      add(new THREE.BoxGeometry(0.62, 0.42, 0.5), M('#f29ec0'), 0, 0.33, 0)
      add(new THREE.ConeGeometry(0.52, 0.32, 4), M('#d6333a'), 0, 0.7, 0, 0, Math.PI / 4)
      door(0, 0.12, 0.26, 0.28, '#7a4a22', '#4a2a12')
      add(new THREE.BoxGeometry(0.4, 0.08, 0.02), M('#ffffff'), 0, 0.5, 0.26)
      add(new THREE.CylinderGeometry(0.03, 0.04, 0.7, 6), M('#9c6b3a'), -0.5, 0.45, -0.2, 0, 0, 0.2)
      add(new THREE.SphereGeometry(0.2, 8, 6), M('#3e9b3e'), -0.57, 0.85, -0.2).scale.y = 0.4
      break
    }
    case 'tower': { // Torre Karin
      add(new THREE.CylinderGeometry(0.1, 0.14, 2.2, 16), M('#f3ead2'), 0, 1.1, 0)
      for (const y of [0.5, 1.1, 1.7]) add(new THREE.TorusGeometry(0.12, 0.02, 6, 16), M('#c9a24a'), 0, y, 0, Math.PI / 2)
      add(new THREE.SphereGeometry(0.3, 16, 12), M('#f3ead2'), 0, 2.35, 0).scale.y = 0.6
      add(new THREE.ConeGeometry(0.08, 0.3, 12), M('#c9a24a'), 0, 2.65, 0)
      break
    }
    default:
      add(new THREE.BoxGeometry(0.4, 0.4, 0.4), M('#ff00ff'), 0, 0.2, 0)
  }
  return g
}

// ------------------------------------------------------------ decoración extra
function extraModel (kind, style) {
  const M = color => styleMat(style, { color })
  const g = new THREE.Group()
  const add = (geo, color, x, y, z, sx = 1, sy = 1, sz = 1) => {
    const mesh = new THREE.Mesh(geo, M(color)); mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); mesh.castShadow = true; g.add(mesh); return mesh
  }
  if (kind === 'car') { // el descapotable rojo de Kaio
    add(new THREE.BoxGeometry(0.62, 0.16, 0.34), '#d62a2a', 0, 0.14, 0)
    add(new THREE.SphereGeometry(0.2, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), '#d62a2a', 0.05, 0.2, 0, 1.2, 0.55, 0.85)
    add(new THREE.BoxGeometry(0.2, 0.1, 0.28), '#e8f4ff', -0.02, 0.3, 0)
    for (const [x, z] of [[-0.2, 0.17], [0.2, 0.17], [-0.2, -0.17], [0.2, -0.17]]) {
      const w = add(new THREE.CylinderGeometry(0.075, 0.075, 0.05, 14), '#1a1a1a', x, 0.075, z); w.rotation.x = Math.PI / 2
    }
    add(new THREE.CylinderGeometry(0.006, 0.006, 0.25, 4), '#888', 0.22, 0.35, 0.1)
  } else if (kind === 'bubbles') { // el mono de Kaio
    add(new THREE.SphereGeometry(0.13, 14, 10), '#6b3a1e', 0, 0.2, 0, 1, 1.1, 0.9)
    add(new THREE.SphereGeometry(0.11, 14, 10), '#6b3a1e', 0, 0.41, 0)
    add(new THREE.SphereGeometry(0.07, 12, 8), '#e2b48a', 0, 0.39, 0.07, 1, 0.8, 0.6)
    for (const s of [-1, 1]) {
      add(new THREE.SphereGeometry(0.045, 8, 6), '#e2b48a', s * 0.11, 0.44, 0)
      add(new THREE.CylinderGeometry(0.03, 0.03, 0.18, 6), '#6b3a1e', s * 0.14, 0.26, 0.02).rotation.z = -s * 0.8
    }
  } else if (kind === 'gregory') { // el grillo
    add(new THREE.SphereGeometry(0.1, 14, 10), '#1c1c22', 0, 0.12, 0, 1, 0.9, 1.2)
    add(new THREE.SphereGeometry(0.075, 12, 8), '#1c1c22', 0, 0.24, 0.07)
    add(new THREE.SphereGeometry(0.03, 8, 6), '#f4c542', 0, 0.23, 0.13)
    for (const s of [-1, 1]) add(new THREE.CylinderGeometry(0.006, 0.006, 0.16, 4), '#1c1c22', s * 0.03, 0.36, 0.06).rotation.z = s * 0.4
  } else if (kind === 'kaio') {
    return heroModel('kaio', style === 'pixel' ? 'bricks' : style) // Kaio no tiene sprite pixel-art
  } else if (kind === 'well') { // brasero/pozo de piedra
    add(new THREE.CylinderGeometry(0.22, 0.24, 0.16, 20), '#f1d58c', 0, 0.08, 0)
    add(new THREE.CylinderGeometry(0.15, 0.15, 0.02, 20), '#6b4a2a', 0, 0.17, 0)
    add(new THREE.BoxGeometry(0.03, 0.2, 0.03), '#6b4a2a', 0.08, 0.26, 0)
  }
  return g
}

// ------------------------------------------------------------ personajes 3D (figuras)
// Colores de cada personaje para las figuras de los estilos "bloques" y "cartoon"
export const FIGURES = {
  goku: { skin: '#f2c79b', hair: 'goku', hairColor: '#17161c', top: '#f07a22', under: '#2a57b8', belt: '#2a57b8', legs: '#f07a22', boots: '#2a57b8', emblem: true },
  goku_ssj: { skin: '#f2c79b', hair: 'goku', hairColor: '#ffd64a', top: '#f07a22', under: '#2a57b8', belt: '#2a57b8', legs: '#f07a22', boots: '#2a57b8', emblem: true, eyes: '#1aa58a' },
  goku_ssj2: { skin: '#f2c79b', hair: 'goku', hairColor: '#ffe06a', top: '#f07a22', under: '#2a57b8', belt: '#2a57b8', legs: '#f07a22', boots: '#2a57b8', emblem: true, eyes: '#1aa58a' },
  goku_ssj3: { skin: '#f2c79b', hair: 'long', hairColor: '#ffd64a', top: '#f07a22', under: '#2a57b8', belt: '#2a57b8', legs: '#f07a22', boots: '#2a57b8', emblem: true, eyes: '#1aa58a' },
  goku_nino: { skin: '#f2c79b', hair: 'goku', hairColor: '#17161c', top: '#3f4ea8', under: '#2d6fb5', belt: '#c9cdd8', legs: '#3f4ea8', boots: '#8a4a2a', scale: 0.8 },
  gohan: { skin: '#f2c79b', hair: 'gohan', hairColor: '#17161c', top: '#7a4bb0', under: '#7a4bb0', belt: '#d6333a', legs: '#7a4bb0', boots: '#7c4a22', scale: 0.9 },
  gohan_ssj: { skin: '#f2c79b', hair: 'gohan', hairColor: '#ffd64a', top: '#7a4bb0', under: '#7a4bb0', belt: '#d6333a', legs: '#7a4bb0', boots: '#7c4a22', scale: 0.9, eyes: '#1aa58a' },
  krilin: { skin: '#f2c79b', hair: 'bald', top: '#f07a22', under: '#2a57b8', belt: '#2a57b8', legs: '#f07a22', boots: '#2a57b8', emblem: true, dots: true, scale: 0.85 },
  vegeta: { skin: '#f2c79b', hair: 'vegeta', hairColor: '#17161c', top: '#f4f4f4', under: '#2a4fb0', belt: '#f4f4f4', legs: '#2a4fb0', boots: '#f4f4f4', arms: '#2a4fb0', hands: '#f4f4f4', pads: '#e8c14a' },
  vegeta_ssj: { skin: '#f2c79b', hair: 'vegeta', hairColor: '#ffd64a', top: '#f4f4f4', under: '#2a4fb0', belt: '#f4f4f4', legs: '#2a4fb0', boots: '#f4f4f4', arms: '#2a4fb0', hands: '#f4f4f4', pads: '#e8c14a', eyes: '#1aa58a' },
  piccolo: { skin: '#6cc24a', hair: 'turban', hairColor: '#f4f4f4', top: '#5a3a9a', under: '#5a3a9a', belt: '#3b6fd6', legs: '#5a3a9a', boots: '#7c4a22', cape: '#f4f4f4' },
  bulma: { skin: '#f2c79b', hair: 'bulma', hairColor: '#4fb3d9', top: '#f29ec0', under: '#f29ec0', belt: '#d6333a', legs: '#2d3a5c', boots: '#8a5a3a', scale: 0.9 },
  kaio: { skin: '#4f8fd8', hair: 'kaio', hairColor: '#1c1c22', top: '#1c1c22', under: '#d6333a', belt: '#d6333a', legs: '#f4f4f4', boots: '#1c1c22', emblem: true, glasses: true }
}

function faceTexture (f, style, uFront, dy = 0) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256
  const g = cv.getContext('2d')
  g.fillStyle = f.skin; g.fillRect(0, 0, 512, 256)
  const cx = uFront * 512
  if (f.glasses) {
    g.fillStyle = '#111'
    g.beginPath(); g.ellipse(cx - 34, 110 + dy, 30, 18, 0, 0, Math.PI * 2); g.ellipse(cx + 34, 110 + dy, 30, 18, 0, 0, Math.PI * 2); g.fill()
    g.fillRect(cx - 10, 104 + dy, 20, 6)
  } else {
    for (const s of [-1, 1]) {
      g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(cx + s * 34, 112 + dy, 17, 22, 0, 0, Math.PI * 2); g.fill()
      g.fillStyle = f.eyes || '#15131b'; g.beginPath(); g.ellipse(cx + s * 30, 116 + dy, 11, 17, 0, 0, Math.PI * 2); g.fill()
      g.fillStyle = '#111'; g.beginPath(); g.ellipse(cx + s * 30, 118 + dy, 6, 10, 0, 0, Math.PI * 2); g.fill()
      g.fillStyle = '#fff'; g.beginPath(); g.arc(cx + s * 26, 108 + dy, 4, 0, Math.PI * 2); g.fill()
      g.strokeStyle = '#15131b'; g.lineWidth = 7
      g.beginPath(); g.moveTo(cx + s * 14, 80 + dy + (f.hair === 'vegeta' ? 8 : 0)); g.lineTo(cx + s * 54, 84 + dy - (f.hair === 'vegeta' ? 8 : 0)); g.stroke()
    }
  }
  // sonrisa
  g.strokeStyle = '#6b2a1e'; g.lineWidth = 6
  g.beginPath(); g.arc(cx, 150 + dy, 24, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke()
  g.fillStyle = '#ffffff'; g.beginPath(); g.arc(cx, 154 + dy, 17, 0.1 * Math.PI, 0.9 * Math.PI); g.fill()
  if (f.dots) {
    g.fillStyle = '#9a5a3a'
    for (const [dx, dy] of [[-20, 28], [0, 22], [20, 28], [-20, 48], [0, 42], [20, 48]]) { g.beginPath(); g.arc(cx + dx, dy, 5, 0, Math.PI * 2); g.fill() }
  }
  return canvasTex(cv, style)
}

function torsoTexture (f, style) {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 256
  const g = cv.getContext('2d')
  g.fillStyle = f.top; g.fillRect(0, 0, 256, 256)
  g.fillStyle = f.under; g.beginPath(); g.moveTo(80, 0); g.lineTo(176, 0); g.lineTo(128, 90); g.fill()
  g.fillStyle = f.belt; g.fillRect(0, 205, 256, 40)
  if (f.emblem) {
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(70, 110, 30, 0, Math.PI * 2); g.fill()
    g.strokeStyle = '#111'; g.lineWidth = 7; g.stroke()
    g.fillStyle = '#111'; g.font = 'bold 40px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('亀', 70, 112)
  }
  if (f.pads) { g.fillStyle = f.pads; g.fillRect(0, 0, 50, 40); g.fillRect(206, 0, 50, 40) }
  return canvasTex(cv, style)
}

// peinados como conjunto de conos alrededor de la cabeza
function addHair (group, f, style, headY, headR) {
  const mat = styleMat(style, { color: f.hairColor || '#17161c' })
  const cap = (ry = 0.75) => {
    const c = new THREE.Mesh(new THREE.SphereGeometry(headR * 1.08, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat)
    c.position.y = headY + headR * 0.05; c.scale.y = ry; group.add(c)
  }
  // punta cónica que sale de la cabeza en la dirección (elevación, giro)
  const spike = (len, r, elev, yaw) => {
    const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(elev), Math.sin(elev), Math.cos(yaw) * Math.cos(elev))
    const s = new THREE.Mesh(new THREE.ConeGeometry(r, len, 6), mat)
    s.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)
    s.position.set(0, headY + headR * 0.35, 0).addScaledVector(dir, headR * 0.75 + len / 2)
    group.add(s)
  }
  switch (f.hair) {
    case 'goku':
    case 'gohan': {
      cap()
      const big = f.hair === 'goku' ? 1 : 0.75
      // puntas hacia arriba y atrás, abiertas en abanico (estilo Goku)
      // [longitud, elevación, giro]: abanico hacia arriba, los lados y atrás
      const spikes = [[1.0, 1.25, 0.3], [1.1, 1.0, 2.6], [1.1, 0.9, -2.6], [1.0, 0.55, 2.0], [1.0, 0.55, -2.0],
        [0.9, 0.2, 1.7], [0.9, 0.2, -1.7], [1.0, 0.45, 3.14], [0.8, 1.1, 1.2], [0.8, 1.1, -1.2]]
      for (const [len, elev, yaw] of spikes) spike(headR * 1.2 * len * big, headR * 0.32, elev, yaw)
      // flequillo hacia delante
      for (const x of [-0.45, 0, 0.45]) {
        const b = new THREE.Mesh(new THREE.ConeGeometry(headR * 0.18, headR * 0.5, 5), mat)
        b.position.set(x * headR, headY + headR * 0.55, headR * 0.82); b.rotation.x = Math.PI * 0.72; group.add(b)
      }
      break
    }
    case 'long': { // SSJ3
      cap()
      for (let i = 0; i < 7; i++) spike(headR * 1.3, headR * 0.35, 0.9 - Math.abs(i - 3) * 0.15, Math.PI + (i - 3) * 0.45)
      const mane = new THREE.Mesh(new THREE.ConeGeometry(headR * 0.9, headR * 3.2, 10), mat)
      mane.position.set(0, headY - headR * 0.9, -headR * 0.9); mane.rotation.x = -0.25; group.add(mane)
      break
    }
    case 'vegeta': {
      cap(0.8)
      for (const [x, z, h, tilt] of [[0, -0.1, 2.2, 0], [-0.4, -0.1, 1.8, 0.25], [0.4, -0.1, 1.8, -0.25], [-0.2, -0.4, 1.9, 0.1], [0.2, -0.4, 1.9, -0.1], [0, 0.25, 1.4, 0]]) {
        const s = new THREE.Mesh(new THREE.ConeGeometry(headR * 0.42, headR * h, 7), mat)
        s.position.set(x * headR, headY + headR * (0.5 + h / 2), z * headR); s.rotation.z = tilt; group.add(s)
      }
      break
    }
    case 'bulma': {
      cap(0.9)
      for (const s of [-1, 1]) {
        const side = new THREE.Mesh(new THREE.CylinderGeometry(headR * 0.35, headR * 0.45, headR * 1.3, 12), mat)
        side.position.set(s * headR * 0.85, headY - headR * 0.2, -headR * 0.1); group.add(side)
      }
      const back = new THREE.Mesh(new THREE.SphereGeometry(headR * 1.05, 16, 10), mat)
      back.position.set(0, headY - headR * 0.1, -headR * 0.35); back.scale.set(1, 1.05, 0.7); group.add(back)
      break
    }
    case 'turban': {
      const t = new THREE.Mesh(new THREE.SphereGeometry(headR * 1.18, 20, 12, 0, Math.PI * 2, 0, Math.PI / 1.8), mat)
      t.position.y = headY + headR * 0.05; group.add(t)
      const gem = new THREE.Mesh(new THREE.SphereGeometry(headR * 0.25, 12, 8), styleMat(style, { color: '#7a4bb0' }))
      gem.position.set(0, headY + headR * 1.05, 0); gem.scale.y = 0.6; group.add(gem)
      break
    }
    case 'kaio': {
      for (const s of [-1, 1]) {
        const a = new THREE.Mesh(new THREE.CylinderGeometry(headR * 0.06, headR * 0.06, headR * 1.2, 6), mat)
        a.position.set(s * headR * 0.35, headY + headR * 1.4, 0); a.rotation.z = -s * 0.25; group.add(a)
        const tip = new THREE.Mesh(new THREE.SphereGeometry(headR * 0.14, 8, 6), mat)
        tip.position.set(s * headR * 0.52, headY + headR * 1.98, 0); group.add(tip)
      }
      break
    }
    default: break
  }
}

// Figura estilo "minifigura" (bloques) o "chibi" (cartoon)
export function heroModel (id, style = 'bricks') {
  if (style === 'pixel') return characterModel(id, 0.06)
  const f = FIGURES[id] || FIGURES.goku
  const g = new THREE.Group()
  const M = color => styleMat(style, { color })
  const add = (geo, mat, x, y, z) => { const mesh = new THREE.Mesh(geo, mat); mesh.position.set(x, y, z); mesh.castShadow = true; g.add(mesh); return mesh }
  if (style === 'bricks') {
    // minifigura: piernas, cadera, torso trapezoidal, brazos, cabeza cilíndrica
    for (const s of [-1, 1]) {
      add(new THREE.BoxGeometry(0.19, 0.24, 0.21), M(f.legs), s * 0.1, 0.22, 0)
      add(new THREE.BoxGeometry(0.19, 0.1, 0.23), M(f.boots), s * 0.1, 0.05, 0.01)
    }
    add(new THREE.BoxGeometry(0.4, 0.07, 0.2), M(f.legs), 0, 0.37, 0)
    const torsoGeo = new THREE.BoxGeometry(0.42, 0.34, 0.2)
    const p = torsoGeo.attributes.position
    for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) p.setX(i, p.getX(i) * 0.8)
    torsoGeo.computeVertexNormals()
    const plain = M(f.top)
    add(torsoGeo, [plain, plain, plain, plain, styleMat(style, { map: torsoTexture(f, style) }), plain], 0, 0.575, 0)
    for (const s of [-1, 1]) {
      const arm = add(new THREE.CylinderGeometry(0.055, 0.06, 0.26, 12), M(f.arms || f.top), s * 0.22, 0.6, 0.02)
      arm.rotation.z = s * 0.18
      add(new THREE.CylinderGeometry(0.05, 0.05, 0.07, 12), M(f.hands || f.skin), s * 0.25, 0.44, 0.04)
      if (f.pads) add(new THREE.SphereGeometry(0.08, 12, 8), M(f.pads), s * 0.2, 0.72, 0).scale.y = 0.6
    }
    add(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 12), M(f.skin), 0, 0.76, 0)
    const head = add(new THREE.CylinderGeometry(0.15, 0.15, 0.21, 32, 1, false, Math.PI, Math.PI * 2),
      [styleMat(style, { map: faceTexture(f, style, 0.5, 30) }), M(f.skin), M(f.skin)], 0, 0.88, 0)
    head.rotation.y = 0
    add(new THREE.CylinderGeometry(0.09, 0.09, 0.05, 16), M(f.skin), 0, 1.0, 0)
    addHair(g, f, style, 0.93, 0.15)
    if (f.cape) add(new THREE.BoxGeometry(0.46, 0.62, 0.03), M(f.cape), 0, 0.42, -0.13)
  } else {
    // chibi cartoon: cabeza grande y cuerpo pequeño, con contorno negro
    for (const s of [-1, 1]) {
      add(new THREE.CapsuleGeometry(0.07, 0.12, 4, 10), M(f.legs), s * 0.09, 0.15, 0)
      add(new THREE.SphereGeometry(0.085, 14, 10), M(f.boots), s * 0.09, 0.05, 0.02).scale.set(1, 0.7, 1.3)
      add(new THREE.CapsuleGeometry(0.05, 0.14, 4, 10), M(f.arms || f.top), s * 0.2, 0.38, 0).rotation.z = s * 0.35
      add(new THREE.SphereGeometry(0.06, 12, 8), M(f.hands || f.skin), s * 0.26, 0.28, 0.01)
    }
    add(new THREE.CapsuleGeometry(0.15, 0.12, 6, 16), M(f.top), 0, 0.36, 0)
    add(new THREE.TorusGeometry(0.15, 0.03, 8, 20), M(f.belt), 0, 0.27, 0).rotation.x = Math.PI / 2
    add(new THREE.SphereGeometry(0.28, 32, 24), styleMat(style, { map: faceTexture(f, style, 0.25) }), 0, 0.74, 0)
    addHair(g, f, style, 0.78, 0.28)
    if (f.cape) add(new THREE.BoxGeometry(0.4, 0.45, 0.03), M(f.cape), 0, 0.33, -0.17)
    // contorno (casco invertido)
    const outline = new THREE.MeshBasicMaterial({ color: '#141020', side: THREE.BackSide })
    const shells = []
    g.traverse(o => { if (o.isMesh) shells.push(o) })
    for (const o of shells) {
      const sh = new THREE.Mesh(o.geometry, outline)
      sh.position.copy(o.position); sh.rotation.copy(o.rotation); sh.scale.copy(o.scale).multiplyScalar(1.07)
      o.parent.add(sh)
    }
  }
  g.scale.setScalar(f.scale || 1)
  return g
}
