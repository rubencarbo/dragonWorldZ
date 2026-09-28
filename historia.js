// HISTORIA — Modo Historia: un libro de cómic interactivo que recorre la saga
// desde el principio, vivido en primera persona por el protagonista de cada
// capítulo. Cada capítulo son páginas (viñetas) de distintos tipos:
//   · panel   → viñeta con cartelas y bocadillos que avanzan al tocar
//   · explore → la viñeta tiene objetos que tocar (los brillantes son clave)
//   · battle  → minijuego (los mismos del mundo abierto)
// Las viñetas se pintan en un lienzo de 320×200 (el modo VGA de los PC de los
// 90) con escenarios procedurales y los sprites de personajes.js.
// La pantalla que lo muestra (LibroView) está en pantallas.js.
import { spriteData } from './motor.js'

// ============================================================ PINTOR DE ESCENAS
export const W = 320
export const H = 200

function rng (seed) {
  let s = (seed >>> 0) || 1
  return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296
}
function rect (c, x, y, w, h, col) {
  c.fillStyle = col
  c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h))
}
// círculo "a píxeles" por filas (sin antialias)
function disc (c, cx, cy, r, col) {
  c.fillStyle = col
  for (let dy = -r; dy <= r; dy++) {
    const w = Math.round(Math.sqrt(r * r - dy * dy))
    c.fillRect(Math.round(cx - w), Math.round(cy + dy), w * 2 + 1, 1)
  }
}
function ellipse (c, cx, cy, rx, ry, col) {
  c.fillStyle = col
  for (let dy = -ry; dy <= ry; dy++) {
    const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / (ry * ry))))
    c.fillRect(Math.round(cx - w), Math.round(cy + dy), w * 2 + 1, 1)
  }
}
// cielo por bandas con tramado entre colores (como los degradados de 256 colores)
function sky (c, cols, y0 = 0, y1 = H) {
  const bh = (y1 - y0) / cols.length
  cols.forEach((col, i) => rect(c, 0, y0 + i * bh, W, bh + 1, col))
  for (let i = 1; i < cols.length; i++) {
    const y = Math.round(y0 + i * bh)
    c.fillStyle = cols[i]
    for (let x = 0; x < W; x += 2) { c.fillRect(x, y - 2, 1, 1); c.fillRect(x + 1, y - 4, 1, 1) }
    c.fillStyle = cols[i - 1]
    for (let x = 0; x < W; x += 2) c.fillRect(x + 1, y + 1, 1, 1)
  }
}
// cordillera: suma de picos triangulares, dibujada columna a columna
function mountains (c, col, base, amp, seed, { snow, shade, peaks = 6 } = {}) {
  const r = rng(seed)
  const ps = Array.from({ length: peaks }, () => ({ x: r() * W * 1.2 - W * 0.1, h: amp * (0.45 + r() * 0.55), s: 0.7 + r() * 0.9 }))
  for (let x = 0; x < W; x++) {
    let h = 0; let top = null
    for (const p of ps) { const v = p.h - Math.abs(x - p.x) * p.s; if (v > h) { h = v; top = p } }
    if (h <= 0) continue
    rect(c, x, base - h, 1, h + 1, shade && top && x > top.x ? shade : col)
    if (snow && top && h > top.h - 7) rect(c, x, base - h, 1, Math.min(4, h - (top.h - 7)), snow)
  }
}
// las agujas de roca de la Montaña Paoz (tan típicas de los fondos del anime)
function rockPillars (c, base, seed, col = '#8a7a9a', shade = '#6a5a7e') {
  const r = rng(seed)
  for (let i = 0; i < 7; i++) {
    const x = 10 + r() * 300; const w = 8 + r() * 12; const h = 30 + r() * 55
    rect(c, x, base - h, w, h, col)
    rect(c, x + w * 0.6, base - h, w * 0.4, h, shade)
    ellipse(c, x + w / 2, base - h, w / 2 + 3, 3, '#5aa84a')
  }
}
function hills (c, col, base, amp, freq, phase) {
  for (let x = 0; x < W; x++) {
    const h = amp * (0.6 + 0.4 * Math.sin(x * freq + phase)) + amp * 0.25 * Math.sin(x * freq * 2.3 + phase * 2)
    rect(c, x, base - h, 1, H - base + h, col)
  }
}
function ground (c, y, col, speck, seed) {
  rect(c, 0, y, W, H - y, col)
  const r = rng(seed)
  c.fillStyle = speck
  for (let i = 0; i < 160; i++) c.fillRect(Math.floor(r() * W), Math.floor(y + r() * (H - y)), 2, 1)
}
function pine (c, x, y, h, col = '#2f7a3a', dark = '#1f5a2a') {
  rect(c, x - 1, y - h * 0.2, 3, h * 0.2, '#6a4a2a')
  for (let tier = 0; tier < 3; tier++) {
    const ty = y - h * 0.18 - tier * h * 0.25
    const th = h * 0.38
    for (let dy = 0; dy < th; dy++) {
      const w = Math.round((dy / th) * (h * 0.32 - tier * h * 0.06))
      rect(c, x - w, ty - th + dy, w, 1, col)
      rect(c, x, ty - th + dy, w + 1, 1, dark)
    }
  }
}
function tree (c, x, y, r, col = '#3f9a3a', dark = '#2a7a2e') {
  rect(c, x - 2, y - r, 4, r, '#6a4a2a')
  disc(c, x, y - r * 1.5, r, dark)
  disc(c, x - r * 0.25, y - r * 1.65, r * 0.8, col)
  disc(c, x - r * 0.45, y - r * 1.9, r * 0.35, '#7ccf5a')
}
function palm (c, x, y, h) {
  for (let i = 0; i < h; i++) rect(c, x + Math.sin(i / h * 1.6) * 6, y - i, 3, 1, i % 4 ? '#8a6a3a' : '#6a4a2a')
  const tx = x + Math.sin(1.6) * 6
  for (const [dx, dy] of [[-14, 4], [14, 4], [-10, -3], [10, -3], [0, -6]]) {
    for (let k = 0; k < 12; k++) rect(c, tx + dx * k / 12, y - h + dy * k / 12 + (k * k) / 24, 3, 2, k % 3 ? '#3fae4a' : '#2a8a3a')
  }
  disc(c, tx + 1, y - h + 2, 2, '#6a4a2a')
}
function cactus (c, x, y, h) {
  rect(c, x - 2, y - h, 5, h, '#3f9a4a')
  rect(c, x - 8, y - h * 0.7, 3, h * 0.3, '#3f9a4a'); rect(c, x - 8, y - h * 0.45, 7, 3, '#3f9a4a')
  rect(c, x + 5, y - h * 0.85, 3, h * 0.35, '#3f9a4a'); rect(c, x + 2, y - h * 0.55, 6, 3, '#3f9a4a')
  rect(c, x + 1, y - h, 1, h, '#2a7a3a')
}
function rock (c, x, y, w, h, col = '#8a8a9a', dark = '#6a6a7a') {
  ellipse(c, x, y - h / 2, w / 2, h / 2, dark)
  ellipse(c, x - w * 0.1, y - h * 0.6, w * 0.38, h * 0.38, col)
}
function clouds (c, time, y, n, col = '#ffffff', speed = 4, seed = 3) {
  const r = rng(seed)
  for (let i = 0; i < n; i++) {
    const w = 18 + r() * 26
    const x = ((r() * (W + 80) + time * speed * (0.6 + r() * 0.8)) % (W + 80)) - 40
    const yy = y + r() * 30
    ellipse(c, x, yy, w, 5, col)
    disc(c, x - w * 0.3, yy - 4, 7, col)
    disc(c, x + w * 0.15, yy - 6, 9, col)
  }
}
function water (c, y0, y1, col, light, time) {
  rect(c, 0, y0, W, y1 - y0, col)
  c.fillStyle = light
  for (let row = y0 + 2; row < y1; row += 4) {
    const dir = (row / 4) % 2 ? 1 : -1
    for (let i = 0; i < 6; i++) {
      const x = ((i * 61 + row * 7 + time * 8 * dir) % (W + 20) + W + 20) % (W + 20) - 10
      c.fillRect(Math.round(x), row, 6 + (i % 3) * 3, 1)
    }
  }
}
function stars (c, n, maxY, seed, time = 0) {
  const r = rng(seed)
  for (let i = 0; i < n; i++) {
    const x = r() * W; const y = r() * maxY; const tw = Math.sin(time * 3 + i) > 0.6
    rect(c, x, y, 1, 1, tw ? '#ffffff' : '#9aa0d0')
  }
}
function moon (c, x, y, r, full = true) {
  disc(c, x, y, r + 3, '#3a3a6a')
  disc(c, x, y, r, '#fff4c2')
  if (full) {
    disc(c, x - r * 0.3, y - r * 0.2, r * 0.22, '#e8dca0')
    disc(c, x + r * 0.35, y + r * 0.3, r * 0.15, '#e8dca0')
    disc(c, x + r * 0.1, y - r * 0.45, r * 0.1, '#e8dca0')
  } else disc(c, x + r * 0.45, y - r * 0.2, r * 0.9, '#10123a')
}
function sun (c, x, y, r, col = '#fff2a0', glow = '#ffd86a') {
  disc(c, x, y, r + 4, glow)
  disc(c, x, y, r, col)
}
function flames (c, cx, base, width, height, time, seed = 1) {
  const r = rng(seed + Math.floor(time * 10))
  for (let x = -width / 2; x < width / 2; x += 2) {
    const h = height * (0.4 + r() * 0.6) * (1 - Math.abs(x) / width)
    rect(c, cx + x, base - h, 2, h, '#e8401a')
    rect(c, cx + x, base - h * 0.7, 2, h * 0.7, '#ff8a1a')
    rect(c, cx + x, base - h * 0.35, 2, h * 0.35, '#ffe04a')
  }
}

// ---------- edificios y objetos ----------
function houseGoku (c, x, y) {
  // la casita redonda del abuelo Gohan, con tejado chino
  rect(c, x - 22, y - 26, 44, 26, '#e8d8b0')
  rect(c, x + 8, y - 26, 14, 26, '#cdbb92')
  rect(c, x - 6, y - 17, 12, 17, '#5a3a2a')
  disc(c, x - 14, y - 16, 4, '#5a3a2a'); disc(c, x - 14, y - 16, 3, '#8ac8f0')
  for (let i = 0; i < 12; i++) rect(c, x - 30 + i * 0.6, y - 26 - i, 60 - i * 1.2, 1, i < 3 ? '#8a2a1a' : '#b8402a')
  rect(c, x - 33, y - 27, 4, 3, '#8a2a1a'); rect(c, x + 29, y - 27, 4, 3, '#8a2a1a')
  disc(c, x, y - 40, 3, '#f0c040')
}
function domeHouse (c, x, y, lit = false) {
  ellipse(c, x, y - 16, 28, 18, '#e8ecf4')
  rect(c, x - 28, y - 16, 56, 16, '#e8ecf4')
  rect(c, x + 12, y - 30, 14, 30, '#c8ccd8')
  rect(c, x - 26, y - 12, 52, 3, '#3a6ae0')
  rect(c, x - 5, y - 14, 10, 14, '#3a4a6a')
  const win = lit ? '#ffe070' : '#7ac0f0'
  rect(c, x - 20, y - 22, 7, 5, win); rect(c, x + 13, y - 22, 7, 5, win)
  c.fillStyle = '#ffffff'; c.font = 'bold 5px monospace'; c.fillText('CC', x - 3, y - 6)
}
function adobe (c, x, y, w, h, col = '#d8b07a', shade = '#b88a5a') {
  rect(c, x, y - h, w, h, col)
  rect(c, x + w * 0.7, y - h, w * 0.3, h, shade)
  rect(c, x - 2, y - h - 3, w + 4, 3, shade)
  rect(c, x + w * 0.2, y - h * 0.55, w * 0.18, h * 0.55, '#4a2a1a')
  rect(c, x + w * 0.5, y - h * 0.8, w * 0.14, h * 0.18, '#2a1a1a')
}
function castlePilaf (c, x, y, s = 1, col = '#b89ad8', shade = '#8a6aae') {
  const R = (dx, dy, w, h, k) => rect(c, x + dx * s, y + dy * s, w * s, h * s, k)
  R(-40, -40, 80, 40, col); R(10, -40, 30, 40, shade)
  R(-55, -60, 20, 60, col); R(35, -60, 20, 60, shade)
  R(-15, -70, 30, 30, col)
  ellipse(c, x - 45 * s, y - 64 * s, 12 * s, 9 * s, '#e05a8a'); rect(c, x - 45.5 * s, y - 80 * s, 1.5 * s, 8 * s, '#e05a8a')
  ellipse(c, x + 45 * s, y - 64 * s, 12 * s, 9 * s, '#c0406a'); rect(c, x + 44.5 * s, y - 80 * s, 1.5 * s, 8 * s, '#c0406a')
  ellipse(c, x, y - 76 * s, 17 * s, 13 * s, '#e05a8a'); rect(c, x - 0.7 * s, y - 97 * s, 1.5 * s, 10 * s, '#e05a8a')
  R(-8, -22, 16, 22, '#3a2a4a')
  for (const dx of [-50, -30, 20, 40]) R(dx, -30, 6, 8, '#3a2a4a')
}
function castleGyumao (c, x, y) {
  rect(c, x - 26, y - 30, 52, 30, '#e8e0c8')
  rect(c, x + 8, y - 30, 18, 30, '#c8c0a8')
  for (let i = 0; i < 10; i++) rect(c, x - 32 + i * 0.8, y - 30 - i, 64 - i * 1.6, 1, '#2a6a4a')
  rect(c, x - 16, y - 58, 32, 18, '#e8e0c8')
  for (let i = 0; i < 8; i++) rect(c, x - 22 + i, y - 58 - i, 44 - i * 2, 1, '#2a6a4a')
  rect(c, x - 5, y - 14, 10, 14, '#5a2a1a')
}
function car (c, x, y, col = '#e8404a') {
  ellipse(c, x, y - 10, 22, 8, col)
  ellipse(c, x - 2, y - 17, 11, 6, '#9ad4f8')
  rect(c, x - 22, y - 10, 44, 5, col)
  disc(c, x - 13, y - 4, 5, '#222'); disc(c, x + 13, y - 4, 5, '#222')
  disc(c, x - 13, y - 4, 2, '#aaa'); disc(c, x + 13, y - 4, 2, '#aaa')
  rect(c, x + 18, y - 12, 4, 3, '#ffe070')
}
function kinton (c, x, y, s = 1, time = 0) {
  const b = Math.round(Math.sin(time * 3) * 2)
  ellipse(c, x, y + b, 24 * s, 7 * s, '#f0b429')
  disc(c, x - 10 * s, y - 4 * s + b, 8 * s, '#f6d33c')
  disc(c, x + 6 * s, y - 5 * s + b, 10 * s, '#f6d33c')
  ellipse(c, x + 26 * s, y + 2 * s + b, 8 * s, 4 * s, '#f0b429')
  disc(c, x + 4 * s, y - 9 * s + b, 3 * s, '#fff2a0')
}
function dragonBall (c, x, y, r, stars = 4, glow = false, time = 0) {
  if (glow) disc(c, x, y, r + 3 + Math.round(Math.sin(time * 5) * 1.5), '#ffe07a')
  disc(c, x, y, r, '#e8801a')
  disc(c, x - r * 0.15, y - r * 0.15, r * 0.8, '#ffa02a')
  disc(c, x - r * 0.4, y - r * 0.45, Math.max(1, r * 0.2), '#fff2c0')
  const pos = [[0, 0], [-0.35, -0.2], [0.35, 0.2], [0.35, -0.3], [-0.35, 0.3], [0, 0.4], [0, -0.45]]
  for (let i = 0; i < stars; i++) {
    const [dx, dy] = stars === 1 ? [0, 0] : pos[(i + 1) % 7]
    rect(c, x + dx * r - 1, y + dy * r - 1, 2, 2, '#c8201a')
  }
}
function bigFish (c, x, y) {
  ellipse(c, x, y, 26, 10, '#6a8ab0')
  ellipse(c, x - 2, y + 3, 22, 5, '#b8cce0')
  for (let i = 0; i < 12; i++) rect(c, x + 24 + i, y - i * 0.9, 2, i * 1.8 + 1, '#5a7aa0')
  disc(c, x - 18, y - 3, 2, '#111')
}
function pterodactyl (c, x, y, time = 0) {
  const f = Math.sin(time * 8) * 8
  c.fillStyle = '#8a5a3a'
  c.beginPath(); c.moveTo(x, y); c.lineTo(x - 34, y - f); c.lineTo(x - 10, y + 4); c.fill()
  c.beginPath(); c.moveTo(x, y); c.lineTo(x + 34, y - f); c.lineTo(x + 10, y + 4); c.fill()
  ellipse(c, x, y + 2, 7, 5, '#a86a42')
  rect(c, x - 16, y - 2, 12, 3, '#a86a42'); rect(c, x - 22, y - 1, 7, 2, '#e0b060')
  rect(c, x - 13, y - 6, 4, 4, '#a86a42'); rect(c, x - 12, y - 5, 1, 1, '#111')
}
function altar (c, x, y) {
  rect(c, x - 22, y - 16, 44, 4, '#7a3a1a')
  rect(c, x - 20, y - 12, 4, 12, '#5a2a10'); rect(c, x + 16, y - 12, 4, 12, '#5a2a10')
  ellipse(c, x, y - 19, 9, 3, '#c8202a')
}
function lightning (c, x, y0, y1, time) {
  if (Math.sin(time * 7) < 0.85) return
  let xx = x
  for (let y = y0; y < y1; y += 6) { const nx = xx + (Math.random() - 0.5) * 16; c.strokeStyle = '#e8f0ff'; c.lineWidth = 2; c.beginPath(); c.moveTo(xx, y); c.lineTo(nx, y + 6); c.stroke(); xx = nx }
}
// emoji pixelado (para animales sin sprite: oso, pterodáctilo pequeño...)
const emojiCache = new Map()
function emojiSprite (ch, px = 20) {
  const k = ch + px
  if (emojiCache.has(k)) return emojiCache.get(k)
  const cv = document.createElement('canvas')
  cv.width = px; cv.height = px
  const x = cv.getContext('2d')
  x.textAlign = 'center'; x.textBaseline = 'middle'
  x.font = `${px * 0.9}px sans-serif`
  x.fillText(ch, px / 2, px / 2 + 1)
  emojiCache.set(k, cv)
  return cv
}

// ---------- escenarios ----------
export const SCENES = {
  carretera: (c, time) => {
    sky(c, ['#5aa8f0', '#78baf2', '#9accf4', '#bfe0f6'], 0, 110)
    clouds(c, time, 12, 4)
    mountains(c, '#8aa0c8', 110, 60, 11, { snow: '#f4f8ff', shade: '#7088b4' })
    rockPillars(c, 118, 5)
    hills(c, '#5aae4a', 125, 12, 0.03, 1)
    ground(c, 128, '#4a9a3a', '#3a8a2e', 2)
    // camino de tierra hacia el horizonte
    for (let y = 128; y < H; y++) { const k = (y - 128) / (H - 128); const w = 10 + k * 140; rect(c, 160 - w / 2 + Math.sin(k * 3) * 20 * (1 - k), y, w, 1, y % 6 < 3 ? '#c8a06a' : '#bb945e') }
    for (const [x, y, h] of [[30, 150, 40], [60, 140, 30], [270, 150, 44], [300, 138, 30], [240, 136, 24]]) pine(c, x, y, h)
  },
  bosque: (c, time) => {
    sky(c, ['#62b0f0', '#86c4f4', '#b0daf6'], 0, 100)
    clouds(c, time, 10, 3)
    rockPillars(c, 110, 9)
    hills(c, '#3f8a3a', 118, 14, 0.04, 2)
    ground(c, 122, '#58a848', '#48983a', 4)
    for (let i = 0; i < 9; i++) tree(c, 12 + i * 38 + (i % 2) * 10, 124 + (i % 3) * 3, 10 + (i % 3) * 2)
    for (let y = 150; y < H; y++) rect(c, 120 + (y - 150) * 0.4, y, 70 + (y - 150) * 0.6, 1, '#c8a870')
    for (const [x, y] of [[20, 180], [300, 175], [260, 196]]) tree(c, x, y, 16)
  },
  rio: (c, time) => {
    sky(c, ['#62b0f0', '#8ac6f4', '#b8def6'], 0, 95)
    clouds(c, time, 8, 3)
    rockPillars(c, 105, 21)
    hills(c, '#3f8a3a', 110, 10, 0.05, 3)
    ground(c, 112, '#58a848', '#48983a', 6)
    water(c, 142, 168, '#3a8ae0', '#b8e0ff', time)
    rect(c, 0, 140, W, 2, '#8a7a5a'); rect(c, 0, 168, W, 2, '#8a7a5a')
    for (const [x, y, w] of [[60, 160, 20], [200, 150, 16], [270, 164, 22]]) rock(c, x, y, w, 9)
    for (let i = 0; i < 6; i++) tree(c, 20 + i * 56, 118, 11)
  },
  casa_goku: (c, time) => {
    sky(c, ['#5aa8f0', '#80bef4', '#a8d4f6', '#d0e8f8'], 0, 118)
    clouds(c, time, 10, 3)
    mountains(c, '#9aaed0', 108, 50, 31, { shade: '#8298c0' })
    rockPillars(c, 124, 13)
    hills(c, '#4a9a3a', 128, 8, 0.05, 1)
    ground(c, 130, '#5aaa48', '#4a9a3a', 8)
    houseGoku(c, 232, 150)
    tree(c, 290, 152, 14); tree(c, 40, 146, 13); pine(c, 175, 142, 30)
    for (let y = 150; y < H; y++) rect(c, 222 - (y - 150) * 0.5, y, 20 + (y - 150) * 0.5, 1, '#c8a870')
  },
  interior: (c, time) => {
    rect(c, 0, 0, W, 140, '#c89a62')
    for (let x = 0; x < W; x += 22) rect(c, x, 0, 2, 140, '#a87a48')
    rect(c, 0, 140, W, 60, '#8a5a32')
    for (let y = 146; y < H; y += 8) rect(c, 0, y, W, 1, '#6a4222')
    // ventana con vistas a las agujas de roca
    c.save(); c.beginPath(); c.rect(34, 34, 52, 36); c.clip()
    rect(c, 34, 34, 52, 36, '#8ac8f0'); clouds(c, time, 36, 2)
    rockPillars(c, 74, 3)
    c.restore()
    rect(c, 30, 30, 60, 4, '#6a4222'); rect(c, 30, 70, 60, 4, '#6a4222')
    rect(c, 30, 30, 4, 44, '#6a4222'); rect(c, 86, 30, 4, 44, '#6a4222')
    rect(c, 59, 34, 2, 36, '#6a4222'); rect(c, 34, 51, 52, 2, '#6a4222')
    altar(c, 210, 150)
    // foto del abuelo Gohan
    rect(c, 196, 40, 28, 34, '#6a4222'); rect(c, 199, 43, 22, 28, '#e8dcc0'); disc(c, 210, 54, 6, '#d8b890'); rect(c, 203, 60, 14, 11, '#6a8a4a')
  },
  playa: (c, time) => {
    sky(c, ['#4aa0f0', '#6ab4f4', '#8ac8f6', '#b0dcf8'], 0, 110)
    clouds(c, time, 14, 4)
    water(c, 110, 150, '#2a7ad8', '#9ad0ff', time)
    rect(c, 0, 110, W, 1, '#1a5ab0')
    for (let x = 0; x < W; x++) { const y = 150 + Math.sin(x * 0.05 + time * 2) * 2; rect(c, x, y - 2, 1, 3, '#e8f4ff') }
    ground(c, 152, '#f0dc9a', '#e0c880', 12)
    palm(c, 40, 170, 60); palm(c, 290, 176, 50)
    rock(c, 250, 158, 26, 12)
  },
  cielo: (c, time) => {
    sky(c, ['#3a8ae8', '#5aa0f0', '#7ab8f4', '#a0d0f8', '#c8e6fa'])
    clouds(c, time * 5, 20, 5, '#ffffff', 10, 5)
    clouds(c, time * 5, 120, 5, '#eaf4ff', 16, 9)
  },
  aldea: (c, time) => {
    sky(c, ['#78b4e8', '#98c8ec', '#c8dcec', '#ecdcc0'], 0, 110)
    mountains(c, '#b8a08a', 112, 40, 41, { shade: '#a08a74' })
    ground(c, 115, '#e0c894', '#d0b47c', 14)
    adobe(c, 20, 150, 50, 34); adobe(c, 230, 146, 60, 38); adobe(c, 120, 128, 40, 26)
    rect(c, 0, 170, W, 30, '#d8bc84')
    cactus(c, 95, 160, 22)
  },
  desierto: (c, time) => {
    sky(c, ['#e8a050', '#f0b868', '#f6d08a', '#fae4b0'], 0, 115)
    sun(c, 250, 40, 14)
    mountains(c, '#c87a4a', 115, 42, 51, { shade: '#a8623a', peaks: 4 })
    for (let x = 0; x < W; x++) {
      const y1 = 130 + Math.sin(x * 0.02) * 6
      const y2 = 158 + Math.sin(x * 0.03 + 2) * 8
      rect(c, x, y1, 1, H - y1, '#e8c07a'); rect(c, x, y2, 1, H - y2, '#dcae68')
    }
    cactus(c, 60, 170, 28); cactus(c, 280, 180, 20)
    rock(c, 200, 176, 30, 14, '#b8845a', '#98683e')
  },
  desierto_noche: (c, time) => {
    sky(c, ['#0a0c2a', '#141a44', '#1e2a5a', '#2a3a6a'], 0, 125)
    stars(c, 60, 110, 7, time)
    moon(c, 260, 34, 10, false)
    for (let x = 0; x < W; x++) { const y1 = 128 + Math.sin(x * 0.02) * 6; rect(c, x, y1, 1, H - y1, '#4a3a5a') }
    domeHouse(c, 110, 162, true)
    // hoguera
    rect(c, 196, 168, 20, 4, '#5a3a2a')
    flames(c, 206, 168, 16, 16, time, 3)
  },
  montana_fuego: (c, time) => {
    sky(c, ['#5a1a1a', '#8a2a1a', '#c8481a', '#e8781a'], 0, 150)
    clouds(c, time, 10, 4, '#4a2a2a', 3, 17)
    mountains(c, '#5a3a2a', 170, 110, 3, { peaks: 1, shade: '#4a2a1a' })
    castleGyumao(c, 160, 72)
    flames(c, 160, 90, 120, 26, time, 1)
    flames(c, 70, 150, 40, 18, time, 2); flames(c, 250, 150, 40, 18, time, 5)
    ground(c, 170, '#3a2a1a', '#5a3a2a', 3)
  },
  montana_apagada: (c, time) => {
    sky(c, ['#5aa8f0', '#80bef4', '#b0d6f6'], 0, 150)
    clouds(c, time, 10, 3, '#d8d8d8')
    for (let x = 0; x < W; x++) { const h = Math.max(0, 40 - Math.abs(x - 160) * 0.3) + (x % 7 === 0 ? 3 : 0); rect(c, x, 170 - h, 1, h, '#6a5a4a') }
    ground(c, 170, '#6a5a4a', '#8a7a6a', 5)
    for (let i = 0; i < 5; i++) ellipse(c, 120 + i * 20, 130 - i * 8 - (time * 6 % 20), 12, 6, '#c8c8c8')
  },
  castillo: (c, time) => {
    sky(c, ['#2a1a4a', '#4a2a6a', '#8a4a7a', '#d87a6a'], 0, 150)
    stars(c, 25, 60, 12, time)
    mountains(c, '#3a2a4a', 150, 50, 61)
    castlePilaf(c, 170, 158, 1)
    ground(c, 158, '#5a4a5a', '#4a3a4a', 9)
    rock(c, 40, 190, 40, 18, '#6a5a6a', '#4a3a4a')
  },
  celda: (c, time) => {
    rect(c, 0, 0, W, H, '#4a4e5a')
    for (let y = 0; y < H; y += 20) for (let x = (y / 20) % 2 * 20; x < W; x += 40) rect(c, x, y, 38, 18, '#555a68')
    rect(c, 0, 160, W, 40, '#3a3e4a')
    rect(c, 140, 20, 40, 30, '#10123a'); moon(c, 160, 35, 8)
    for (let x = 144; x < 180; x += 8) rect(c, x, 20, 2, 30, '#8a8e9a')
  },
  noche_luna: (c, time) => {
    sky(c, ['#05061a', '#0a0c2a', '#141a44', '#1e2a5a'])
    stars(c, 90, 150, 23, time)
    moon(c, 160, 60, 34)
    castlePilaf(c, 250, 200, 0.8, '#1a1428', '#120e1e')
    rect(c, 0, 176, W, 24, '#0a0812')
  },
  shenron: (c, time) => {
    sky(c, ['#050a08', '#0a1a14', '#12281e', '#1a3a2a'])
    lightning(c, 60 + (Math.floor(time) * 97) % 200, 0, 120, time)
    stars(c, 20, 100, 31, time)
    ground(c, 172, '#1a2a1e', '#2a3a2e', 4)
    for (let i = 0; i < 7; i++) dragonBall(c, 120 + (i % 4) * 26 - (i > 3 ? -13 : 0), 176 + (i > 3 ? 10 : 0), 5, i + 1, true, time)
  },
  amanecer: (c, time) => {
    sky(c, ['#3a4a8a', '#8a6a9a', '#e8906a', '#f8c070'], 0, 150)
    sun(c, 160, 150, 20, '#fff0a0', '#ffc860')
    clouds(c, time, 40, 3, '#f0b890')
    for (let x = 0; x < W; x++) { const h = x > 180 && x < 300 ? (x % 17 < 9 ? 26 : 14) : 0; rect(c, x, 170 - h, 1, h, '#4a3a4a') }
    ground(c, 170, '#5a4a4a', '#4a3a3a', 2)
  }
}

// ---------- actores (sprites de personajes y objetos) ----------
const spriteCache = new Map()
function spriteCanvas (id) {
  const sp = spriteData(id)
  if (!sp) return null
  const key = id + ':' + sp.grid.length + ':' + (sp.grid[0]?.length || 0) + ':' + Object.values(sp.palette || {}).join('')
  if (spriteCache.has(key)) return spriteCache.get(key)
  const w = Math.max(...sp.grid.map(r => r.length))
  const cv = document.createElement('canvas')
  cv.width = w; cv.height = sp.grid.length
  const x = cv.getContext('2d')
  sp.grid.forEach((row, yy) => { for (let xx = 0; xx < row.length; xx++) { const col = sp.palette?.[row[xx]]; if (col) { x.fillStyle = col; x.fillRect(xx, yy, 1, 1) } } })
  // recorte de márgenes vacíos para medir bien la altura
  let top = 0; let bottom = sp.grid.length - 1
  while (top < bottom && !/[^.]/.test(sp.grid[top])) top++
  while (bottom > top && !/[^.]/.test(sp.grid[bottom])) bottom--
  const out = { cv, top, h: bottom - top + 1, w }
  spriteCache.set(key, out)
  return out
}
// silueta de un sprite (para Ozaru a contraluz de la luna)
function silhouette (cv, col) {
  const s = document.createElement('canvas')
  s.width = cv.width; s.height = cv.height
  const x = s.getContext('2d')
  x.drawImage(cv, 0, 0)
  x.globalCompositeOperation = 'source-in'
  x.fillStyle = col
  x.fillRect(0, 0, s.width, s.height)
  return s
}

// rectángulo (en px de la viñeta) que ocupa un actor
export function actorBox (a) {
  const h = (a.h || 0.4) * H
  if (a.id) {
    const sp = spriteCanvas(a.id)
    const w = sp ? h * sp.w / sp.h : h * 0.5
    return { x: a.x * W - w / 2, y: a.y * H - h, w, h }
  }
  // objetos: tamaño en px según su dibujo (con s = escala)
  const k = a.s || 1
  const size = { ball: [16, 16], kinton: [60, 26], car: [48, 28], fish: [64, 24], ptero: [72, 24], dome: [60, 48], fire: [30, 20], beam: [0, 0], panties: [16, 12] }[a.thing]
  if (size) {
    const [w, hh] = [size[0] * k, size[1] * k]
    const cy = a.thing === 'ptero' || a.thing === 'kinton' ? a.y * H + hh / 2 : a.y * H
    return { x: a.x * W - w / 2, y: cy - hh, w, h: hh }
  }
  return { x: a.x * W - h / 2, y: a.y * H - h, w: h, h }
}

function drawActor (c, a, time) {
  if (a.hidden) return
  const box = actorBox(a)
  let dy = 0; let dx = 0
  if (a.anim === 'bob') dy = Math.round(Math.sin(time * 4 + a.x * 9) * 1.5)
  if (a.anim === 'jump') dy = -Math.abs(Math.round(Math.sin(time * 6) * 10))
  if (a.anim === 'shake') dx = Math.round(Math.sin(time * 40) * 2)
  if (a.anim === 'fly') dy = Math.round(Math.sin(time * 2.5) * 4)
  if (a.id) {
    const sp = spriteCanvas(a.id)
    if (!sp) return
    let src = sp.cv
    if (a.silhouette) src = silhouette(sp.cv, a.silhouette)
    c.save()
    c.imageSmoothingEnabled = false
    const x = Math.round(box.x + dx); const y = Math.round(box.y + dy)
    if (a.flip) { c.translate(x + box.w, y); c.scale(-1, 1) } else c.translate(x, y)
    // sombra en el suelo
    if (!a.noShadow && !a.silhouette) { c.globalAlpha = 0.25; c.fillStyle = '#000'; c.beginPath(); c.ellipse(box.w / 2, box.h - dy, box.w * 0.35, 2.5, 0, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1 }
    c.drawImage(src, 0, sp.top, sp.w, sp.h, 0, 0, box.w, box.h)
    c.restore()
    if (a.silhouette && a.eyes) {
      const ey = box.y + box.h * 0.12 + dy
      rect(c, box.x + box.w * 0.36, ey, 3, 2, '#ff2a2a'); rect(c, box.x + box.w * 0.56, ey, 3, 2, '#ff2a2a')
    }
    return
  }
  const cx = a.x * W + dx; const by = a.y * H + dy
  const s = a.s || 1
  switch (a.thing) {
    case 'ball': dragonBall(c, cx, by - 6 * s, Math.round(6 * s), a.stars || 4, a.glow, time); break
    case 'kinton': kinton(c, cx, by, s, time); break
    case 'car': car(c, cx, by, a.color); break
    case 'fish': bigFish(c, cx, by - 10); break
    case 'ptero': pterodactyl(c, cx, by, time); break
    case 'dome': domeHouse(c, cx, by, a.lit); break
    case 'fire': flames(c, cx, by, 30 * s, 20 * s, time, 7); break
    case 'emoji': {
      const px = Math.round((a.h || 0.2) * H)
      const e = emojiSprite(a.char, 16)
      c.save(); c.imageSmoothingEnabled = false
      if (a.flip) { c.translate(cx + px / 2, by - px); c.scale(-1, 1); c.drawImage(e, 0, 0, px, px) } else c.drawImage(e, cx - px / 2, by - px, px, px)
      c.restore()
      break
    }
    case 'beam': {
      // onda Kamehameha: haz azul con núcleo blanco
      const len = (a.len || 0.5) * W * Math.min(1, (a.grow ? (time % 2) : 1) * 2)
      const dir = a.flip ? -1 : 1
      for (let i = 0; i < len; i += 2) {
        const r = 5 + Math.sin(i * 0.3 + time * 20) * 1.5
        rect(c, cx + i * dir, by - r, 2, r * 2, '#4ab0ff')
        rect(c, cx + i * dir, by - r * 0.45, 2, r * 0.9, '#e8f8ff')
      }
      disc(c, cx + len * dir, by, 9, '#8ad0ff'); disc(c, cx + len * dir, by, 5, '#ffffff')
      break
    }
    case 'panties': {
      // el deseo de Oolong, cayendo del cielo (ropa interior de dibujos animados)
      const yy = by + ((time * 30) % 40)
      rect(c, cx - 7, yy, 14, 4, '#ffffff'); rect(c, cx - 7, yy + 4, 5, 4, '#ffffff'); rect(c, cx + 2, yy + 4, 5, 4, '#ffffff')
      rect(c, cx - 1, yy + 1, 2, 2, '#ff7ab0')
      break
    }
  }
}

export function paintPanel (c, page, actors, time) {
  c.imageSmoothingEnabled = false
  const scene = SCENES[page.scene] || SCENES.bosque
  scene(c, time)
  const list = [...actors].sort((a, b) => (a.z ?? a.y) - (b.z ?? b.y))
  for (const a of list) drawActor(c, a, time)
  if (page.night) { c.fillStyle = 'rgba(10,10,50,.35)'; c.fillRect(0, 0, W, H) }
}

// ============================================================ GUION · LIBRO 1
// Ayudas para escribir las viñetas en los dos idiomas
const L = (es, ca) => ({ es, ca: ca ?? es })
const cap = (es, ca, x) => ({ cap: L(es, ca), ...x }) // cartela del narrador
const me = (es, ca, x) => ({ me: L(es, ca), ...x }) // pensamiento del protagonista (primera persona)
const say = (who, es, ca, x) => ({ who, say: L(es, ca), ...x }) // bocadillo (who = actor)
const fx = (es, ca, x) => ({ fx: L(es, ca), ...x }) // onomatopeya

// alturas típicas (fracción de la viñeta)
const A = {
  goku: (x, y = 0.93, o) => ({ id: 'goku_nino', key: 'goku', x, y, h: 0.36, ...o }),
  bulma: (x, y = 0.93, o) => ({ id: 'bulma_joven', key: 'bulma', x, y, h: 0.44, ...o }),
  oolong: (x, y = 0.93, o) => ({ id: 'oolong', key: 'oolong', x, y, h: 0.3, ...o }),
  puar: (x, y = 0.7, o) => ({ id: 'puar', key: 'puar', x, y, h: 0.2, anim: 'fly', noShadow: true, ...o }),
  yamcha: (x, y = 0.93, o) => ({ id: 'yamcha', key: 'yamcha', x, y, h: 0.5, ...o }),
  roshi: (x, y = 0.93, o) => ({ id: 'roshi', key: 'roshi', x, y, h: 0.42, ...o }),
  umigame: (x, y = 0.95, o) => ({ id: 'umigame', key: 'umigame', x, y, h: 0.22, ...o }),
  chichi: (x, y = 0.93, o) => ({ id: 'chichi_nina', key: 'chichi', x, y, h: 0.36, ...o }),
  gyumao: (x, y = 0.95, o) => ({ id: 'gyumao', key: 'gyumao', x, y, h: 0.8, ...o }),
  pilaf: (x, y = 0.93, o) => ({ id: 'pilaf', key: 'pilaf', x, y, h: 0.3, ...o }),
  shu: (x, y = 0.93, o) => ({ id: 'shu', key: 'shu', x, y, h: 0.38, ...o }),
  dino: (x, y = 0.95, o) => ({ id: 'dino', key: 'dino', x, y, h: 0.6, ...o })
}

export const BOOKS = [{
  id: 'libro1',
  title: L('Las bolas de dragón', 'Les boles de drac'),
  subtitle: L('Libro 1 · La primera búsqueda', 'Llibre 1 · La primera recerca'),
  names: {
    ptero: L('Pterodáctilo', 'Pterodàctil'),
    oso: L('Oso bandido', 'Os bandit'),
    anciana: L('Abuela de Aru', 'Àvia d\'Aru'),
    monstruo: L('¿¿Monstruo??', 'Monstre??'),
    shenron: L('Shenlong', 'Shenron')
  },
  chapters: [
    // ------------------------------------------------------------------ 1
    {
      id: 'c1',
      hero: 'bulma_joven',
      title: L('El niño de la cola', 'El nen de la cua'),
      teaser: L('Una chica genio, un radar y un niño que levanta coches con una mano.', 'Una noia geni, un radar i un nen que aixeca cotxes amb una mà.'),
      music: 'paoz',
      pages: [
        {
          scene: 'carretera',
          actors: [A.bulma(0.42, 0.9), { thing: 'car', key: 'car', x: 0.62, y: 0.92 }],
          beats: [
            me('Me llamo Bulma. Tengo dieciséis años y soy, modestamente, un genio.', 'Em dic Bulma. Tinc setze anys i sóc, modestament, un geni.'),
            me('Estas vacaciones he inventado el radar del dragón. ¡Detecta las bolas de dragón!', 'Aquestes vacances he inventat el radar del drac. Detecta les boles de drac!'),
            me('Dice la leyenda que quien reúna las siete invocará a un dragón que le concederá un deseo.', 'Diu la llegenda que qui reuneixi les set invocarà un drac que li concedirà un desig.'),
            me('Ya tengo dos: la de dos estrellas, que encontré en el sótano de casa, y la de cinco.', 'Ja en tinc dues: la de dues estrelles, que vaig trobar al soterrani de casa, i la de cinc.'),
            say('bulma', '¡Y cuando tenga las siete... pediré el novio perfecto!', 'I quan tingui les set... demanaré el xicot perfecte!'),
            me('El radar señala la Montaña Paoz. Ni una gasolinera en cien kilómetros...', 'El radar assenyala la Muntanya Paoz. Ni una benzinera en cent quilòmetres...')
          ]
        },
        {
          scene: 'carretera',
          actors: [{ thing: 'car', key: 'car', x: 0.3, y: 0.95 }, A.goku(0.72, 0.93, { flip: true }), { thing: 'fish', key: 'fish', x: 0.86, y: 0.9 }],
          beats: [
            cap('En mitad del camino, un niño arrastra un pez más grande que él...', 'Enmig del camí, un nen arrossega un peix més gros que ell...'),
            fx('¡¡FRENAZO!!', 'FRENADA!!', { set: { car: { anim: 'shake' } } }),
            say('goku', '¡Un monstruo con ruedas! ¡Seguro que viene a por mi pescado!', 'Un monstre amb rodes! Segur que ve a buscar el meu peix!'),
            fx('¡CATAPLOF!', 'PATAPUF!', { set: { car: { anim: 'jump' } } }),
            say('bulma', '¿¡Pero qué haces, salvaje!? ¡Es un coche!', 'Però què fas, salvatge!? És un cotxe!', { add: [A.bulma(0.18, 0.93)], set: { car: { anim: null } } }),
            say('goku', '¿Un coche? ¿Y tú qué eres? ¿Una bruja? No tienes cola...', 'Un cotxe? I tu què ets? Una bruixa? No tens cua...'),
            say('bulma', '¡Pues claro que no! Soy una chica. ¿Y tú... TIENES COLA?', 'Doncs clar que no! Sóc una noia. I tu... TENS CUA?'),
            say('goku', 'Me llamo Son Goku. Mi abuelito decía que a las chicas hay que tratarlas bien.', 'Em dic Son Goku. El meu avi deia que a les noies cal tractar-les bé.'),
            me('Un niño con cola que levanta coches con una mano. Esto no sale en ningún libro de ciencia...', 'Un nen amb cua que aixeca cotxes amb una mà. Això no surt a cap llibre de ciència...')
          ]
        },
        {
          scene: 'casa_goku',
          actors: [A.goku(0.52), A.bulma(0.36)],
          beats: [
            cap('La casita de Goku, en lo alto de la Montaña Paoz.', 'La caseta d\'en Goku, dalt de tot de la Muntanya Paoz.'),
            say('goku', 'Esta es mi casa. Vivía con mi abuelito Gohan, pero se fue al otro mundo.', 'Aquesta és casa meva. Hi vivia amb el meu avi Gohan, però se\'n va anar a l\'altre món.'),
            say('goku', 'No estoy solo, eh: su recuerdo vive en una bola mágica.', 'No estic sol, eh: el seu record viu en una bola màgica.'),
            me('¡El radar pita como loco! La bola tiene que estar ahí dentro...', 'El radar xiula com un boig! La bola ha de ser aquí dins...')
          ]
        },
        {
          type: 'explore',
          scene: 'interior',
          actors: [A.bulma(0.3, 0.97), A.goku(0.47, 0.97), { thing: 'ball', key: 'ball', x: 0.656, y: 0.66, stars: 4, glow: true, s: 1 }],
          goal: L('Busca la bola de dragón en casa de Goku', 'Busca la bola de drac a casa d\'en Goku'),
          beats: [me('Dentro huele a arroz y a leña. Vamos a ver...', 'A dins fa olor d\'arròs i de llenya. A veure...')],
          spots: [
            { key: 'foto', box: [0.6, 0.19, 0.1, 0.19], need: true, label: L('Foto', 'Foto'), lines: [
              say('goku', 'Es mi abuelito Gohan. Me encontró en el bosque cuando era un bebé.', 'És el meu avi Gohan. Em va trobar al bosc quan era un nadó.'),
              me('Tiene cara de buena persona... y de haber tenido mucha paciencia.', 'Té cara de bona persona... i d\'haver tingut molta paciència.')
            ] },
            { key: 'ball', actor: 'ball', need: true, label: L('Cojín', 'Coixí'), lines: [
              say('goku', '¡Esa es la bola de cuatro estrellas! Es el recuerdo de mi abuelito.', 'Aquesta és la bola de quatre estrelles! És el record del meu avi.'),
              say('bulma', '¡Una bola de dragón! ¡Lo sabía!', 'Una bola de drac! Ho sabia!')
            ] },
            { key: 'ventana', box: [0.09, 0.15, 0.19, 0.22], label: L('Ventana', 'Finestra'), lines: [
              me('Por la ventana se ven las agujas de roca de Paoz. Qué vistas...', 'Per la finestra es veuen les agulles de roca de Paoz. Quines vistes...')
            ] },
            { key: 'goku', actor: 'goku', label: L('Goku', 'Goku'), lines: [
              say('goku', '¿Tienes hambre? ¡Puedo pescar otro pez gigante!', 'Tens gana? Puc pescar un altre peix gegant!')
            ] }
          ],
          done: [
            say('bulma', '¡Mira, Goku! Yo también tengo dos.', 'Mira, Goku! Jo també en tinc dues.', { add: [{ thing: 'ball', key: 'b2', x: 0.22, y: 0.62, stars: 2, glow: true }, { thing: 'ball', key: 'b5', x: 0.32, y: 0.58, stars: 5, glow: true }] }),
            say('goku', '¿Hay más abuelitos? ¡Se parecen mucho!', 'Hi ha més avis? S\'assemblen molt!'),
            me('Tuve que explicarle que no eran su abuelo. Más o menos.', 'Li vaig haver d\'explicar que no eren el seu avi. Més o menys.')
          ]
        },
        {
          type: 'battle',
          scene: 'casa_goku',
          night: true,
          actors: [A.bulma(0.4), A.goku(0.58)],
          beats: [
            cap('Se hace de noche. Bulma saca su estuche de cápsulas.', 'Es fa de nit. La Bulma treu l\'estoig de càpsules.'),
            say('bulma', 'Una de estas es mi casa... ¡pero están todas mezcladas!', 'Una d\'aquestes és casa meva... però estan totes barrejades!')
          ],
          game: 'memory',
          config: { pairs: 4, tries: 10 },
          hero: 'bulma_joven',
          enemy: { name: L('Estuche de cápsulas', 'Estoig de càpsules'), emoji: '💊' },
          win: [
            fx('¡PUF!', 'PUF!', { add: [{ thing: 'dome', key: 'dome', x: 0.2, y: 0.8, lit: true }] }),
            say('goku', '¡Una casa que sale de una pastilla! ¿Eres una maga?', 'Una casa que surt d\'una pastilla! Ets una maga?'),
            say('bulma', 'Soy una científica. Y esta noche dormimos a cubierto.', 'Sóc una científica. I aquesta nit dormim a cobert.')
          ],
          lose: [say('bulma', '¡Uy! Esa era la moto... Otra vez.', 'Ui! Aquesta era la moto... Una altra vegada.')]
        },
        {
          scene: 'casa_goku',
          night: true,
          actors: [{ thing: 'dome', key: 'dome', x: 0.2, y: 0.8, lit: true }, A.bulma(0.42), A.goku(0.58)],
          beats: [
            say('bulma', 'Oye, Goku... ¿por qué no vienes conmigo a buscar las bolas? Conocerás a gente fortísima.', 'Escolta, Goku... per què no véns amb mi a buscar les boles? Coneixeràs gent fortíssima.'),
            say('goku', '¿Gente fuerte? ¡Pues claro que voy! ¡Así me haré más fuerte!', 'Gent forta? Doncs clar que hi vaig! Així em faré més fort!', { set: { goku: { anim: 'jump' } } }),
            me('Y así empezó la aventura más grande de mi vida... aunque todavía no lo sabía.', 'I així va començar l\'aventura més gran de la meva vida... tot i que encara no ho sabia.')
          ]
        }
      ]
    },
    // ------------------------------------------------------------------ 2
    {
      id: 'c2',
      hero: 'goku_nino',
      title: L('La tortuga y el Maestro Roshi', 'La tortuga i el Follet Tortuga'),
      teaser: L('Un pterodáctilo, una tortuga perdida y una nube que solo aguanta a los de buen corazón.', 'Un pterodàctil, una tortuga perduda i un núvol que només aguanta els de bon cor.'),
      music: 'kame',
      pages: [
        {
          scene: 'bosque',
          actors: [A.goku(0.4), A.bulma(0.6)],
          beats: [
            me('¡Hola! Soy Son Goku. Voy con Bulma a buscar las bolas de dragón.', 'Hola! Sóc en Son Goku. Vaig amb la Bulma a buscar les boles de drac.'),
            me('Bulma es un poco rara: no sabe pescar, no sabe cazar y grita muchísimo.', 'La Bulma és una mica estranya: no sap pescar, no sap caçar i crida moltíssim.'),
            cap('De repente, una sombra cruza el cielo...', 'De sobte, una ombra travessa el cel...', { add: [{ thing: 'ptero', key: 'ptero', x: 0.85, y: 0.25 }] }),
            fx('¡ÑIIIIC!', 'NYIIIIC!', { set: { ptero: { x: 0.6, y: 0.45 }, bulma: { anim: 'shake' } } }),
            say('bulma', '¡GOKUUU! ¡SOCORRO!', 'GOKUUU! SOCORS!', { set: { bulma: { y: 0.55, anim: 'fly', noShadow: true }, ptero: { x: 0.6, y: 0.3 } } })
          ]
        },
        {
          type: 'battle',
          scene: 'bosque',
          actors: [A.goku(0.35), A.bulma(0.62, 0.55, { anim: 'fly', noShadow: true }), { thing: 'ptero', key: 'ptero', x: 0.62, y: 0.3 }],
          beats: [say('goku', '¡Suelta a Bulma! ¡Nyoibo, crece!', 'Deixa anar la Bulma! Nyoibo, creix!')],
          game: 'reflex',
          config: { theme: 'nyoibo', rounds: 3 },
          hero: 'goku_nino',
          enemy: { name: L('Pterodáctilo', 'Pterodàctil'), emoji: '🦅' },
          win: [
            fx('¡TOC!', 'TOC!', { set: { ptero: { x: 1.2, y: 0.1 }, bulma: { y: 0.93, anim: null, noShadow: false } } }),
            cap('El pterodáctilo suelta a Bulma... y Goku la atrapa al vuelo.', 'El pterodàctil deixa anar la Bulma... i en Goku l\'agafa al vol.'),
            say('bulma', '¡Uf! Gracias, Goku... ¡pero no me aprietes tanto!', 'Uf! Gràcies, Goku... però no m\'estrenyis tant!')
          ],
          lose: [say('goku', '¡Se ha escapado! Tengo que apuntar mejor.', 'S\'ha escapat! He d\'apuntar millor.')]
        },
        {
          scene: 'bosque',
          actors: [A.goku(0.35), A.bulma(0.55), A.umigame(0.78, 0.95, { flip: true })],
          beats: [
            cap('Un poco más adelante, en mitad del bosque...', 'Una mica més endavant, enmig del bosc...'),
            say('umigame', 'Perdonen... ¿saben dónde queda el mar? Llevo un año perdida.', 'Perdonin... saben on és el mar? Fa un any que estic perduda.'),
            say('goku', '¡Una tortuga que habla! ¡Yo te llevo!', 'Una tortuga que parla! Jo t\'hi porto!'),
            say('bulma', '¿Un año? Pues el mar está... lejísimos.', 'Un any? Doncs el mar és... lluny, lluny.'),
            me('Me la cargué a la espalda. Pesaba más que el pez de ayer, ¡pero es buen entrenamiento!', 'Me la vaig carregar a l\'esquena. Pesava més que el peix d\'ahir, però és bon entrenament!')
          ]
        },
        {
          type: 'battle',
          scene: 'bosque',
          actors: [A.goku(0.3), A.umigame(0.45), A.bulma(0.15), { thing: 'emoji', key: 'oso', char: '🐻', x: 0.75, y: 0.95, h: 0.5 }],
          beats: [
            fx('¡GRRROAR!', 'GRRROAR!', { set: { oso: { anim: 'shake' } } }),
            say('oso', '¡Esa tortuga será mi cena! ¡Apártate, enano!', 'Aquesta tortuga serà el meu sopar! Aparta\'t, nano!'),
            say('goku', '¡Ni hablar! ¡Jan... Ken...!', 'Ni parlar-ne! Jan... Ken...!')
          ],
          game: 'rps',
          config: { bestOf: 3 },
          hero: 'goku_nino',
          enemy: { name: L('Oso bandido', 'Os bandit'), emoji: '🐻' },
          win: [
            fx('¡PAM!', 'PAM!', { set: { oso: { anim: 'jump' } } }),
            say('oso', '¡Ay, ay, ay! ¡Me rindo! ¡Me voy a comer bayas!', 'Ai, ai, ai! Em rendeixo! Me\'n vaig a menjar maduixes!', { set: { oso: { hidden: true } } })
          ],
          lose: [say('oso', '¡Ja! ¿Otra vez, enano?', 'Ha! Una altra vegada, nano?')]
        },
        {
          scene: 'playa',
          actors: [A.goku(0.35), A.bulma(0.18), A.umigame(0.6)],
          beats: [
            cap('Por fin, el mar.', 'Per fi, el mar.'),
            say('umigame', '¡El mar! Esperad aquí, os traeré un regalo.', 'El mar! Espereu-vos aquí, us portaré un regal.', { set: { umigame: { x: 0.9, y: 0.78 } } }),
            cap('Al rato, Umigame vuelve... con un anciano sobre el caparazón.', 'Al cap d\'una estona, la tortuga torna... amb un vellet sobre la closca.', { set: { umigame: { x: 0.7, y: 0.95 } }, add: [A.roshi(0.7, 0.8)] }),
            say('roshi', 'Jo, jo, jo. Gracias por ayudar a mi tortuga. Soy el Maestro Roshi.', 'Jo, jo, jo. Gràcies per ajudar la meva tortuga. Sóc el Follet Tortuga.'),
            say('roshi', 'Como premio, os daré... ¡la nube mágica! ¡Kiiintooon!', 'Com a premi, us donaré... el núvol màgic! Kiiintooon!'),
            fx('¡FIUUUU!', 'FIUUUU!', { add: [{ thing: 'kinton', key: 'kinton', x: 0.5, y: 0.55, anim: 'fly' }] })
          ]
        },
        {
          type: 'explore',
          scene: 'playa',
          actors: [A.goku(0.35), A.bulma(0.18), A.umigame(0.7), A.roshi(0.7, 0.8), { thing: 'kinton', key: 'kinton', x: 0.5, y: 0.55, anim: 'fly' }],
          goal: L('Descubre los secretos de la nube Kinton', 'Descobreix els secrets del núvol Kinton'),
          beats: [say('roshi', 'Pero cuidado: solo puede subir quien tenga el corazón puro.', 'Però compte: només hi pot pujar qui tingui el cor pur.')],
          spots: [
            { key: 'kinton', actor: 'kinton', need: true, label: L('Nube', 'Núvol'), lines: [
              say('roshi', 'Mirad, os lo demostraré...', 'Mireu, us ho demostraré...', { set: { roshi: { x: 0.5, y: 0.5 } } }),
              fx('¡PLAF!', 'PLAF!', { set: { roshi: { x: 0.5, y: 0.93, anim: 'shake' } } }),
              say('roshi', '...Ejem. Hoy no es mi día.', '...Ehem. Avui no és el meu dia.', { set: { roshi: { anim: null, x: 0.7, y: 0.8 } } })
            ] },
            { key: 'goku', actor: 'goku', need: true, label: L('Goku', 'Goku'), lines: [
              say('goku', '¡Allá voy!', 'Allà vaig!', { set: { goku: { x: 0.5, y: 0.5, anim: 'fly', noShadow: true }, kinton: { x: 0.5, y: 0.56 } } }),
              say('goku', '¡Estoy volando! ¡Es blandita como un pastel!', 'Estic volant! És toveta com un pastís!')
            ] },
            { key: 'roshi', actor: 'roshi', need: true, label: L('Collar', 'Collaret'), lines: [
              say('bulma', 'Oiga, abuelo... ¿esa bola de su collar no será una bola de dragón?', 'Escolti, avi... aquesta bola del collaret no serà una bola de drac?'),
              say('roshi', '¿Esta? La de tres estrellas. Os la regalo: a mí solo me sirve de adorno.', 'Aquesta? La de tres estrelles. Us la regalo: a mi només em fa de guarniment.', { add: [{ thing: 'ball', key: 'b3', x: 0.18, y: 0.5, stars: 3, glow: true }] })
            ] },
            { key: 'umigame', actor: 'umigame', label: L('Tortuga', 'Tortuga'), lines: [
              say('umigame', 'Gracias por traerme, pequeño. Eres un buen chico.', 'Gràcies per portar-m\'hi, petit. Ets un bon noi.')
            ] }
          ],
          done: [me('Ahora teníamos cuatro bolas... ¡y yo tenía una nube que vuela!', 'Ara teníem quatre boles... i jo tenia un núvol que vola!')]
        }
      ]
    },
    // ------------------------------------------------------------------ 3
    {
      id: 'c3',
      hero: 'goku_nino',
      title: L('Oolong el terrible', 'L\'Oolong, el terrible'),
      teaser: L('Un pueblo aterrorizado por un monstruo que cambia de forma... cinco minutos.', 'Un poble aterrit per un monstre que canvia de forma... cinc minuts.'),
      music: 'capsule',
      pages: [
        {
          scene: 'aldea',
          actors: [A.goku(0.4), A.bulma(0.25), { thing: 'emoji', key: 'anciana', char: '👵', x: 0.7, y: 0.93, h: 0.24 }],
          beats: [
            cap('El radar los lleva a la aldea de Aru. Las calles están vacías...', 'El radar els porta al poble d\'Aru. Els carrers són buits...'),
            say('anciana', '¡Huid! Oolong, el monstruo, viene hoy a llevarse a mi nieta...', 'Fugiu! L\'Oolong, el monstre, ve avui a endur-se la meva néta...'),
            say('bulma', '¿Oolong? ¿Y qué quiere un monstruo de las chicas del pueblo?', 'L\'Oolong? I què vol un monstre de les noies del poble?'),
            say('anciana', '¡Nadie lo sabe! Ya se ha llevado a tres...', 'Ningú no ho sap! Ja se n\'ha endut tres...'),
            me('Un monstruo. ¡Qué ganas de pelear!', 'Un monstre. Quines ganes de lluitar!')
          ]
        },
        {
          scene: 'aldea',
          actors: [A.goku(0.3), A.bulma(0.15), { thing: 'emoji', key: 'monstruo', char: '👹', x: 0.72, y: 0.95, h: 0.62 }],
          beats: [
            cap('Entonces, una sombra enorme aparece en la plaza...', 'Aleshores, una ombra enorme apareix a la plaça...'),
            fx('¡¡UOOOOH!!', 'UOOOOH!!', { set: { monstruo: { anim: 'shake' } } }),
            say('monstruo', '¡Soy Oolong, el terrible! ¡Entregadme a la chica!', 'Sóc l\'Oolong, el terrible! Doneu-me la noia!', { set: { monstruo: { anim: null } } }),
            say('goku', 'Qué raro... hueles a cerdito.', 'Que estrany... fas olor de porquet.')
          ]
        },
        {
          type: 'battle',
          scene: 'aldea',
          actors: [A.goku(0.3), { thing: 'emoji', key: 'monstruo', char: '👹', x: 0.72, y: 0.95, h: 0.62 }],
          beats: [say('goku', '¡Te reto! ¡Jan... Ken...!', 'Et repto! Jan... Ken...!')],
          game: 'rps',
          config: { bestOf: 3 },
          hero: 'goku_nino',
          enemy: { name: L('Oolong (transformado)', 'Oolong (transformat)'), emoji: '👹' },
          win: [
            fx('¡PUF!', 'PUF!', { set: { monstruo: { hidden: true } }, add: [A.oolong(0.72)] }),
            cap('A los cinco minutos, el terrible monstruo se convierte en... un cerdito.', 'Al cap de cinc minuts, el terrible monstre es converteix en... un porquet.'),
            say('oolong', '¡No vale! ¡Solo aguanto cinco minutos transformado!', 'No s\'hi val! Només aguanto cinc minuts transformat!')
          ],
          lose: [say('monstruo', '¡Ja, ja! ¡Nadie puede con Oolong el terrible!', 'Ha, ha! Ningú no pot amb l\'Oolong, el terrible!')]
        },
        {
          type: 'battle',
          scene: 'aldea',
          actors: [A.goku(0.3), A.bulma(0.5), A.oolong(0.72)],
          beats: [
            say('bulma', 'Espera, espera... A ti te conozco. ¡Te expulsaron de la escuela de transformaciones!', 'Espera, espera... A tu et conec. Et van expulsar de l\'escola de transformacions!'),
            say('oolong', '¿Cómo lo sabes? ¡Eso es un secreto!', 'Com ho saps? Això és un secret!'),
            say('bulma', 'Contesta a mis preguntas, cerdito.', 'Respon les meves preguntes, porquet.')
          ],
          game: 'quiz',
          config: { topic: 'oolong', rounds: 4, seconds: 14 },
          hero: 'bulma_joven',
          enemy: { name: L('Oolong', 'Oolong'), sprite: 'oolong' },
          win: [
            say('bulma', 'Toma, un caramelo.', 'Té, un caramel.'),
            say('oolong', '¿Un caramelo? Qué amable...', 'Un caramel? Que amable...'),
            fx('¡GLUP!', 'GLUP!'),
            say('bulma', 'Es un caramelo pipí. Cada vez que yo diga... ¡PIPÍ, PIPÍ!', 'És un caramel pipí. Cada vegada que jo digui... PIPÍ, PIPÍ!'),
            fx('¡CORRE, CORRE!', 'CORRE, CORRE!', { set: { oolong: { anim: 'shake' } } }),
            say('oolong', '¡Nooo! ¡El lavabo! ¡¿Dónde está el lavabo?!', 'Nooo! El lavabo! On és el lavabo?!')
          ],
          lose: [say('oolong', '¡Ja! No sabes nada de mí.', 'Ha! No saps res de mi.')]
        },
        {
          scene: 'aldea',
          actors: [A.goku(0.35), A.bulma(0.2), A.oolong(0.55), { thing: 'emoji', key: 'anciana', char: '👵', x: 0.8, y: 0.93, h: 0.24 }],
          beats: [
            cap('Las chicas raptadas vuelven al pueblo... ¡aburridísimas de la mansión de Oolong!', 'Les noies raptades tornen al poble... avorrides de la mansió de l\'Oolong!'),
            say('anciana', '¡Mi nieta ha vuelto! ¡Gracias, forasteros!', 'La meva néta ha tornat! Gràcies, forasters!', { set: { anciana: { anim: 'jump' } } }),
            say('oolong', 'Pues vaya... Yo les daba pasteles cada día. Ellas solo querían volver a casa.', 'Doncs vaja... Jo els donava pastissos cada dia. Elles només volien tornar a casa.'),
            me('Ahora Oolong viaja con nosotros. Dice que no, pero creo que le caemos bien.', 'Ara l\'Oolong viatja amb nosaltres. Diu que no, però crec que li caiem bé.')
          ]
        }
      ]
    },
    // ------------------------------------------------------------------ 4
    {
      id: 'c4',
      hero: 'yamcha',
      title: L('El bandido del desierto', 'El bandit del desert'),
      teaser: L('El lobo solitario del desierto tiene un punto débil: las chicas.', 'El llop solitari del desert té un punt feble: les noies.'),
      music: 'desierto',
      pages: [
        {
          scene: 'desierto',
          actors: [A.yamcha(0.45), A.puar(0.62, 0.55)],
          beats: [
            me('Me llamo Yamcha, el bandido solitario del desierto.', 'Em dic Iamxa, el bandit solitari del desert.'),
            me('Con Puar asaltamos a los viajeros... pero tengo un problema: cuando veo a una chica, me quedo de piedra.', 'Amb en Pual assaltem els viatgers... però tinc un problema: quan veig una noia, em quedo de pedra.'),
            say('puar', '¡Yamcha, Yamcha! ¡Viene alguien! Un niño con un bastón.', 'Iamxa, Iamxa! Ve algú! Un nen amb un bastó.'),
            say('yamcha', 'Perfecto. Hoy cenaremos bien. ¡Vamos, Puar!', 'Perfecte. Avui soparem bé. Som-hi, Pual!')
          ]
        },
        {
          scene: 'desierto',
          actors: [A.yamcha(0.3), A.puar(0.18, 0.55), A.goku(0.62, 0.93, { flip: true }), A.oolong(0.8, 0.93, { flip: true })],
          beats: [
            say('yamcha', '¡Alto, niño! Dame tus cápsulas y tu dinero.', 'Alto, nen! Dona\'m les càpsules i els diners.'),
            say('goku', '¿Quieres pelear? ¡Genial!', 'Vols lluitar? Genial!', { set: { goku: { anim: 'jump' } } }),
            say('oolong', '¡P-P-Puar! ¡Íbamos juntos a la escuela de transformaciones!', 'P-P-Pual! Anàvem junts a l\'escola de transformacions!', { set: { goku: { anim: null }, oolong: { anim: 'shake' } } }),
            say('puar', '¡Oolong! ¡Tú eras el que hacía trampas en los exámenes!', 'Oolong! Tu eres el que feia trampes als exàmens!')
          ]
        },
        {
          type: 'battle',
          scene: 'desierto',
          actors: [A.yamcha(0.3), A.puar(0.18, 0.55), A.goku(0.62, 0.93, { flip: true })],
          beats: [say('yamcha', '¡Prepárate! ¡Rogafufuken, el puño del lobo!', 'Prepara\'t! Rogafufuken, el puny del llop!')],
          game: 'rps',
          config: { bestOf: 3 },
          hero: 'yamcha',
          enemy: { name: L('Son Goku', 'Son Goku'), sprite: 'goku_nino' },
          win: [
            fx('¡AUUUU!', 'AUUUU!', { set: { goku: { anim: 'shake' } } }),
            say('goku', '¡Uau! ¡Eres muy fuerte! ¡Otra, otra!', 'Uau! Ets molt fort! Una altra, una altra!', { set: { goku: { anim: null } } })
          ],
          lose: [say('goku', '¡Jan-Ken-Pon! ¡Te pillé!', 'Jan-Ken-Pon! T\'he enxampat!')]
        },
        {
          scene: 'desierto',
          actors: [A.yamcha(0.3), A.puar(0.18, 0.55), A.goku(0.62, 0.93, { flip: true }), A.bulma(0.84, 0.93, { flip: true })],
          beats: [
            say('bulma', '¿A qué viene tanto jaleo? ¡Goku, a desayunar!', 'Què és tot aquest enrenou? Goku, a esmorzar!'),
            say('yamcha', '¡U-u-una... CHICA!', 'U-u-una... NOIA!', { set: { yamcha: { anim: 'shake' } } }),
            me('Me puse rojo como un tomate. Ni siquiera podía mirarla.', 'Em vaig posar vermell com un tomàquet. Ni tan sols la podia mirar.'),
            say('puar', '¡Retirada, Yamcha! ¡Retirada!', 'Retirada, Iamxa! Retirada!'),
            fx('¡BRRRUM!', 'BRRRUM!', { set: { yamcha: { hidden: true }, puar: { hidden: true } } }),
            say('bulma', '¿Y a ese qué le pasa?', 'I a aquest què li passa?'),
            say('goku', 'Ni idea. ¡Qué pena, era muy fuerte!', 'Ni idea. Quina pena, era molt fort!')
          ]
        },
        {
          scene: 'desierto_noche',
          actors: [A.yamcha(0.72, 0.95, { flip: true }), A.puar(0.86, 0.6, { flip: true })],
          beats: [
            me('Esa noche no podía dormir.', 'Aquella nit no podia dormir.'),
            say('puar', 'Yamcha, tienen un radar del dragón. Están buscando las bolas.', 'Iamxa, tenen un radar del drac. Busquen les boles.'),
            say('yamcha', '¡Las bolas de dragón! Con un deseo... se me acabaría la vergüenza con las chicas.', 'Les boles de drac! Amb un desig... se m\'acabaria la vergonya amb les noies.'),
            me('Decidido: los seguiremos. Y cuando tengan las siete... ¡serán nuestras!', 'Decidit: els seguirem. I quan tinguin les set... seran nostres!')
          ]
        }
      ]
    },
    // ------------------------------------------------------------------ 5
    {
      id: 'c5',
      hero: 'chichi_nina',
      title: L('La princesa de la Montaña de Fuego', 'La princesa de la Muntanya de Foc'),
      teaser: L('Un castillo en llamas, una promesa... y el primer Kamehameha.', 'Un castell en flames, una promesa... i el primer Kamehameha.'),
      music: 'karin',
      pages: [
        {
          scene: 'montana_fuego',
          actors: [A.chichi(0.35), A.gyumao(0.62)],
          beats: [
            me('Me llamo Chichí. Soy la hija del rey Gyumao.', 'Em dic Xixi. Sóc la filla del Rei Bou.'),
            me('Nuestro castillo, en lo alto de la Montaña de Fuego, arde desde hace años. Nadie puede acercarse.', 'El nostre castell, dalt de la Muntanya de Foc, crema des de fa anys. Ningú no s\'hi pot acostar.'),
            say('gyumao', 'Hija, busca al Maestro Roshi. Su abanico mágico apagará las llamas.', 'Filla, busca el Follet Tortuga. El seu ventall màgic apagarà les flames.'),
            me('Así que me puse mi casco y salí sola. ¡Soy una guerrera!', 'Així que em vaig posar el casc i vaig sortir tota sola. Sóc una guerrera!')
          ]
        },
        {
          scene: 'bosque',
          actors: [A.chichi(0.3), A.dino(0.72, 0.95, { flip: true })],
          beats: [
            cap('En el camino, un dinosaurio hambriento...', 'Pel camí, un dinosaure famolenc...'),
            fx('¡GROAAAR!', 'GROAAAR!', { set: { dino: { anim: 'shake' } } }),
            say('chichi', '¡SOCORRO!', 'SOCORS!', { set: { dino: { anim: null }, chichi: { anim: 'shake' } } }),
            say('goku', '¡Eh, dinosaurio! ¡Déjala en paz!', 'Ei, dinosaure! Deixa-la estar!', { set: { chichi: { anim: null } }, add: [A.goku(0.5, 0.6, { anim: 'fly', noShadow: true }), { thing: 'kinton', key: 'kinton', x: 0.5, y: 0.66, anim: 'fly' }] })
          ]
        },
        {
          type: 'battle',
          scene: 'bosque',
          actors: [A.chichi(0.3), A.goku(0.5), A.dino(0.72, 0.95, { flip: true })],
          beats: [say('chichi', '¡Te ayudo! ¡Jan... Ken...!', 'T\'ajudo! Jan... Ken...!')],
          game: 'rps',
          config: { bestOf: 3 },
          hero: 'chichi_nina',
          enemy: { name: L('Dinosaurio', 'Dinosaure'), sprite: 'dino' },
          win: [
            fx('¡PATAPAM!', 'PATAPAM!', { set: { dino: { hidden: true } } }),
            cap('El dinosaurio huye con el rabo entre las patas.', 'El dinosaure fuig amb la cua entre les potes.')
          ],
          lose: [say('dino', '¡GROAR! (Se relame.)', 'GROAR! (Es llepa.)')]
        },
        {
          scene: 'bosque',
          actors: [A.chichi(0.35), A.goku(0.58, 0.93, { flip: true })],
          beats: [
            say('chichi', '¿Quién eres tú? ¿Y esa cola?', 'Qui ets tu? I aquesta cua?'),
            say('goku', 'Soy Son Goku. Oye, ¿tú eres chico o chica?', 'Sóc en Son Goku. Escolta, tu ets noi o noia?'),
            say('chichi', '¡Chica, por supuesto! ¡Qué maleducado!', 'Noia, és clar! Quin maleducat!'),
            me('Pero era valiente, y fuerte, y me había salvado...', 'Però era valent, i fort, i m\'havia salvat...'),
            say('chichi', 'Goku... ¿te casarás conmigo cuando seamos mayores?', 'Goku... et casaràs amb mi quan siguem grans?'),
            say('goku', '¿Casarse? ¿Eso se come? ¡Vale, lo que tú digas!', 'Casar-se? Això es menja? D\'acord, el que tu diguis!'),
            me('¡Me dijo que sí! Aunque creo que no sabía de qué le hablaba.', 'M\'ha dit que sí! Tot i que crec que no sabia de què li parlava.')
          ]
        },
        {
          scene: 'montana_fuego',
          actors: [A.gyumao(0.87, 0.95, { h: 0.7 }), A.chichi(0.66), A.goku(0.47), A.roshi(0.22, 0.93, { flip: true })],
          beats: [
            cap('El Maestro Roshi ha perdido su abanico... ¡lo tiró con la basura! Así que decide apagar el fuego a su manera.', 'El Follet Tortuga ha perdut el ventall... el va llençar amb les escombraries! Així que decideix apagar el foc a la seva manera.'),
            say('roshi', 'Apartaos todos. Este viejo va a usar toda su fuerza.', 'Aparteu-vos tots. Aquest vell farà servir tota la seva força.', { set: { roshi: { flip: false, anim: 'shake' } } }),
            fx('KAAA... MEEE... HAAA... MEEE...', 'KAAA... MEEE... HAAA... MEEE...'),
            fx('¡¡HAAAAA!!', 'HAAAAA!!', { set: { roshi: { anim: null } }, add: [{ thing: 'beam', key: 'beam', x: 0.3, y: 0.62, len: 0.5, grow: false }] })
          ]
        },
        {
          scene: 'montana_apagada',
          actors: [A.gyumao(0.87, 0.95, { h: 0.7 }), A.chichi(0.66), A.goku(0.47), A.roshi(0.22)],
          beats: [
            fx('¡¡BOOOOM!!', 'BUUUUM!!'),
            cap('El fuego se apagó... y la montaña, y el castillo, también desaparecieron.', 'El foc es va apagar... i la muntanya, i el castell, també van desaparèixer.'),
            say('gyumao', 'Mi... mi castillo...', 'El meu... el meu castell...'),
            say('roshi', 'Jo, jo. Se me ha ido un poquito la mano.', 'Jo, jo. Se m\'ha escapat una mica la mà.'),
            say('goku', '¡Qué técnica tan chula! ¿Cómo era? Ka... me... ha... me...', 'Quina tècnica més xula! Com era? Ka... me... ha... me...')
          ]
        },
        {
          type: 'battle',
          scene: 'montana_apagada',
          actors: [A.roshi(0.1), A.goku(0.3), { thing: 'car', key: 'car', x: 0.78, y: 0.93 }, A.chichi(0.55)],
          beats: [say('goku', '¡Voy a probarlo! ¡Ka... me... ha... me...!', 'Ho provaré! Ka... me... ha... me...!')],
          game: 'reflex',
          config: { theme: 'kamehameha', rounds: 3 },
          hero: 'goku_nino',
          enemy: { name: L('Coche de Bulma', 'Cotxe de la Bulma'), emoji: '🚗' },
          win: [
            fx('¡¡HAAA!!', 'HAAA!!', { add: [{ thing: 'beam', key: 'beam', x: 0.36, y: 0.75, len: 0.4 }] }),
            fx('¡¡CATACROC!!', 'PATACROC!!', { set: { car: { anim: 'jump' }, beam: { hidden: true } } }),
            cap('El primer Kamehameha de Goku... hace volar por los aires el coche de Bulma.', 'El primer Kamehameha d\'en Goku... fa volar pels aires el cotxe de la Bulma.'),
            say('roshi', '(Lo ha aprendido a la primera... Este niño es un genio.)', '(L\'ha après a la primera... Aquest nen és un geni.)', { sprite: 'roshi' }),
            me('Ese día supe que Son Goku sería el hombre más fuerte del mundo.', 'Aquell dia vaig saber que en Son Goku seria l\'home més fort del món.')
          ],
          lose: [say('goku', 'Jo... Solo me ha salido un chispazo.', 'Jo... Només m\'ha sortit una espurna.')]
        }
      ]
    },
    // ------------------------------------------------------------------ 6
    {
      id: 'c6',
      hero: 'oolong',
      title: L('El deseo de Oolong', 'El desig de l\'Oolong'),
      teaser: L('El emperador Pilaf tiene las siete bolas. Solo un cerdito puede salvar el mundo.', 'L\'emperador Pilaf té les set boles. Només un porquet pot salvar el món.'),
      music: 'pilaf',
      pages: [
        {
          scene: 'castillo',
          actors: [A.pilaf(0.45), A.shu(0.64)],
          beats: [
            me('Soy Oolong. Sí, el cerdito. El que se transforma cinco minutos.', 'Sóc l\'Oolong. Sí, el porquet. El que es transforma cinc minuts.'),
            me('Reunimos seis bolas... y nos las robó el emperador Pilaf, el tipo más bajito y más malo del mundo.', 'Vam reunir sis boles... i ens les va robar l\'emperador Pilaf, el tipus més baixet i més dolent del món.'),
            say('pilaf', '¡Muajajá! Con las siete bolas pediré dominar el mundo entero.', 'Muahahà! Amb les set boles demanaré dominar el món sencer.'),
            say('shu', '¡Bien dicho, emperador! ¡Guau!', 'Ben dit, emperador! Bup!')
          ]
        },
        {
          scene: 'celda',
          actors: [A.goku(0.3), A.bulma(0.15), A.yamcha(0.5), A.puar(0.64, 0.6), A.oolong(0.82)],
          beats: [
            cap('Los héroes quedan atrapados en una celda de acero.', 'Els herois queden atrapats en una cel·la d\'acer.'),
            say('bulma', '¡Y todo por culpa de un enano azul!', 'I tot per culpa d\'un nan blau!'),
            say('goku', '¡Tengo una idea! Si el Maestro Roshi pudo... ¡yo también!', 'Tinc una idea! Si el Follet Tortuga va poder... jo també!'),
            fx('¡KAMEHAMEHA!', 'KAMEHAMEHA!', { add: [{ thing: 'beam', key: 'beam', x: 0.34, y: 0.7, len: 0.2 }] }),
            fx('¡CRAC!', 'CRAC!', { set: { beam: { hidden: true } } }),
            cap('Solo abre un agujerito en la pared.', 'Només obre un foradet a la paret.'),
            me('Un agujero pequeñito... del tamaño justo de un cerdito como yo.', 'Un forat petitó... de la mida justa d\'un porquet com jo.')
          ]
        },
        {
          scene: 'shenron',
          actors: [A.pilaf(0.25), A.oolong(0.85, 0.93, { flip: true })],
          beats: [
            cap('Afuera, Pilaf pronuncia las palabras mágicas.', 'A fora, en Pilaf pronuncia les paraules màgiques.'),
            say('pilaf', '¡Sal, dragón, y concédeme mi deseo!', 'Surt, drac, i concedeix-me el meu desig!'),
            fx('¡¡BRRRRRRM!!', 'BRRRRRRM!!', { add: [{ id: 'shenron', key: 'shenron', x: 0.55, y: 0.82, h: 0.8, anim: 'fly', noShadow: true, z: 0 }] }),
            say('shenron', 'Os concederé un deseo, el que queráis. Pedidlo.', 'Us concediré un desig, el que vulgueu. Demaneu-lo.'),
            say('pilaf', '¡Quiero...! Ejem, ejem... Quiero dominar...', 'Vull...! Ehem, ehem... Vull dominar...'),
            me('¡Era ahora o nunca!', 'Era ara o mai!')
          ]
        },
        {
          type: 'battle',
          scene: 'shenron',
          actors: [A.pilaf(0.25), { id: 'shenron', key: 'shenron', x: 0.55, y: 0.82, h: 0.8, anim: 'fly', noShadow: true, z: 0 }, A.oolong(0.85, 0.93, { flip: true })],
          beats: [me('Tenía que gritar más fuerte que Pilaf... ¡y más rápido!', 'Havia de cridar més fort que en Pilaf... i més ràpid!')],
          game: 'reflex',
          config: { theme: 'wish', rounds: 3 },
          hero: 'oolong',
          enemy: { name: L('Emperador Pilaf', 'Emperador Pilaf'), sprite: 'pilaf' },
          win: [
            say('oolong', '¡¡QUIERO UNAS BRAGAS!!', 'VULL UNES CALCETES!!'),
            fx('¡¡CHAN!!', 'TXAN!!'),
            say('shenron', 'Deseo concedido.', 'Desig concedit.', { add: [{ thing: 'panties', key: 'p1', x: 0.3, y: 0.05 }] }),
            say('pilaf', '¿¡UNAS BRAGAS!? ¡NOOOO!', 'UNES CALCETES!? NOOOO!', { set: { pilaf: { anim: 'shake' } } }),
            cap('Las bolas de dragón se elevan y salen volando en todas direcciones.', 'Les boles de drac s\'enlairen i surten volant en totes direccions.', { set: { shenron: { hidden: true } } }),
            say('oolong', 'Jejeje... ¡Al menos no dominará el mundo!', 'Jejeje... Almenys no dominarà el món!')
          ],
          lose: [say('pilaf', '¡Silencio, cerdo! ¡El deseo es mío!', 'Silenci, porc! El desig és meu!')]
        },
        {
          scene: 'noche_luna',
          actors: [A.goku(0.5, 0.95), A.yamcha(0.2), A.puar(0.3, 0.55), A.oolong(0.8)],
          beats: [
            cap('Pilaf, furioso, los vuelve a encerrar. Pero esa noche hay luna llena...', 'En Pilaf, furiós, els torna a tancar. Però aquella nit hi ha lluna plena...'),
            say('goku', 'Qué luna tan bonita...', 'Quina lluna més bonica...'),
            fx('¡¡UOOOOOOH!!', 'UOOOOOOH!!', { set: { goku: { h: 0.95, silhouette: '#1a0e14', eyes: true, anim: 'shake', noShadow: true } } }),
            say('puar', '¡Goku se ha convertido en un mono gigante!', 'En Goku s\'ha convertit en un mico gegant!', { set: { goku: { anim: null } } }),
            me('El abuelo de Goku contaba que las noches de luna llena aparecía un monstruo...', 'L\'avi d\'en Goku explicava que les nits de lluna plena apareixia un monstre...'),
            me('Aquel monstruo... era el propio Goku. Y él nunca lo supo.', 'Aquell monstre... era el mateix Goku. I ell mai no ho va saber.'),
            say('yamcha', '¡La cola! ¡Hay que cortarle la cola!', 'La cua! Li hem de tallar la cua!'),
            say('puar', '¡Déjamelo a mí! ¡Transformación... en tijeras!', 'Deixa-m\'ho a mi! Transformació... en tisores!'),
            fx('¡ZAS!', 'ZAS!', { set: { goku: { h: 0.36, silhouette: null, eyes: false, noShadow: false } } })
          ]
        },
        {
          scene: 'amanecer',
          actors: [A.goku(0.4), A.bulma(0.22), A.oolong(0.6), A.yamcha(0.78), A.puar(0.9, 0.55)],
          beats: [
            cap('Al amanecer, el castillo de Pilaf es solo un montón de ruinas.', 'A trenc d\'alba, el castell d\'en Pilaf només és un munt de runes.'),
            say('goku', 'Ñam... ¿Qué ha pasado? ¿Por qué tengo la ropa hecha trizas?', 'Nyam... Què ha passat? Per què tinc la roba feta miques?'),
            say('bulma', 'Goku... mejor no preguntes.', 'Goku... val més que no ho preguntis.'),
            me('Las bolas se esparcieron por el mundo. Dentro de un año volverán a funcionar.', 'Les boles es van escampar pel món. D\'aquí a un any tornaran a funcionar.'),
            say('goku', '¡Me voy con el Maestro Roshi a entrenar! ¡Quiero ser el más fuerte del mundo!', 'Me\'n vaig amb el Follet Tortuga a entrenar! Vull ser el més fort del món!', { set: { goku: { anim: 'jump' } } }),
            me('Y así terminó la primera búsqueda de las bolas de dragón... gracias a mí. Y a mis bragas.', 'I així va acabar la primera recerca de les boles de drac... gràcies a mi. I a les meves calcetes.'),
            cap('FIN DEL LIBRO 1 · Continuará: «El Torneo de Artes Marciales»', 'FI DEL LLIBRE 1 · Continuarà: «El Torneig d\'Arts Marcials»')
          ]
        }
      ]
    }
  ]
}]
