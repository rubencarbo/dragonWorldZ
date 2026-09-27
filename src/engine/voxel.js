// Utilidades de vóxeles: convierten sprites pixel-art (rejillas) en modelos 3D
// extruidos con InstancedMesh, y convierten imágenes en rejillas pixel-art.
import * as THREE from 'three'
import { PALETTE } from '../data/characters.js'

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
