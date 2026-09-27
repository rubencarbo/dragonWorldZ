// PERSONAJES — generador de sprites pixel-art estilo anime (contorno oscuro,
// sombreado y proporciones tipo Dragon Ball) a partir de una descripción por
// piezas: complexión, peinado, cara, ropa, colores y accesorios.
//
// Cada personaje de CHARACTER_SPECS se convierte en { grid, palette } con
// buildSprite(). El motor extruye esa rejilla a vóxeles para el juego 3D.
// Para modificar un personaje: cambia su spec aquí o usa el editor
// (#/personajes), que permite tocar colores/piezas y retocar píxel a píxel.

// Las formas se diseñan en una rejilla de 44×68 y se rasterizan a SCALE:
// subir SCALE da más detalle (ojos, pelo, pliegues) sin tocar los diseños.
const SCALE = 1.4
const DW = 44
const DH = 68
export const SPRITE_W = Math.round(DW * SCALE)
export const SPRITE_H = Math.round(DH * SCALE)
const OY = 9 // margen superior (en unidades de diseño) para peinados altos

// Paleta genérica (sprites antiguos y objetos sencillos)
export const PALETTE = {
  k: '#15151f', s: '#f6c38e', e: '#1d1d2b', m: '#b4533c', o: '#f47b20', b: '#2250b8', u: '#5fc9d8',
  w: '#f4f4f4', y: '#f6d33c', r: '#d6333a', g: '#46a546', d: '#2f6e2f', n: '#7c4a22', p: '#f29ec0',
  x: '#9a9aa8', v: '#7a4bb0', c: '#e0e0e8'
}

// Colores por defecto de cada pieza (cada personaje sobrescribe los suyos)
const DEFAULT_COLORS = {
  skin: '#f4c08e', hair: '#1c1a24', eye: '#161420', white: '#ffffff', mouth: '#8e2f2f',
  top: '#f47b20', under: '#2250b8', sash: '#2250b8', pants: '#f47b20', boots: '#2250b8', cuff: '#e8e2d0',
  bands: '#2250b8', gloves: '#f4f4f4', pole: '#c8322e', poleEnd: '#d9a441', strap: '#7a4a22',
  ball: '#ffa51f', star: '#d6333a', cape: '#f2f2f2', pad: '#f6d33c', turban: '#f2f2f2', beard: '#f2f2f2',
  glasses: '#1c1a24', shell: '#7a4bb0', staff: '#8a5a2b', snout: '#e98bb0', dots: '#b07a5a', whisker: '#9a9aa8'
}

// Complexiones: posiciones clave del cuerpo (x centrada en 22)
const RIGS = {
  kid: { head: [22, 16, 8.5, 9], torso: [27, 39, 9, 8], sash: 2, legs: [42, 53], boots: [53, 58], arm: 2.1 },
  short: { head: [22, 18, 8, 8.5], torso: [28, 40, 9.5, 8.5], sash: 2, legs: [43, 53], boots: [53, 58], arm: 2.1 },
  adult: { head: [22, 11, 6.8, 7.6], torso: [20, 36, 11, 8], sash: 2, legs: [39, 52], boots: [52, 58], arm: 2.3 },
  slim: { head: [22, 12, 7, 7.8], torso: [21, 35, 8, 6.5], sash: 1, legs: [37, 53], boots: [54, 58], arm: 1.7 }
}

// ------------------------------------------------------------ lienzo y primitivas
function canvas () {
  return { px: new Array(SPRITE_W * SPRITE_H).fill(null) }
}
function set (c, x, y, part) {
  x = Math.floor(x * SCALE); y = Math.floor((y + OY) * SCALE)
  if (x < 0 || y < 0 || x >= SPRITE_W || y >= SPRITE_H) return
  c.px[y * SPRITE_W + x] = part
}
function get (c, x, y) {
  if (x < 0 || y < 0 || x >= SPRITE_W || y >= SPRITE_H) return null
  return c.px[y * SPRITE_W + x]
}
// recorre los píxeles reales y evalúa la forma en coordenadas de diseño
function forArea (fn, part, c) {
  for (let py = 0; py < SPRITE_H; py++) {
    for (let px = 0; px < SPRITE_W; px++) {
      if (fn((px + 0.5) / SCALE, (py + 0.5) / SCALE - OY)) c.px[py * SPRITE_W + px] = part
    }
  }
}
function rect (c, x0, y0, x1, y1, part) {
  forArea((x, y) => x >= x0 && x <= x1 + 1 && y >= y0 && y <= y1 + 1, part, c)
}
// rectángulo continuo [x0, x1) × [y0, y1): para detalles finos (ojos, boca, líneas)
function rectC (c, x0, y0, x1, y1, part) {
  forArea((x, y) => x >= Math.min(x0, x1) && x < Math.max(x0, x1) && y >= Math.min(y0, y1) && y < Math.max(y0, y1), part, c)
}
function ellipse (c, cx, cy, rx, ry, part) {
  forArea((x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1, part, c)
}
function poly (c, pts, part) {
  forArea((x, y) => {
    let inside = false
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i]; const [xj, yj] = pts[j]
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
    }
    return inside
  }, part, c)
}
function capsule (c, x1, y1, x2, y2, r, part) {
  forArea((x, y) => {
    const dx = x2 - x1; const dy = y2 - y1
    const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy || 1)))
    return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy)) <= r
  }, part, c)
}

// Coordenadas normalizadas de la cabeza (u, v ∈ [-1, 1] = elipse de la cara)
function headSpace (rig) {
  const [cx, cy, rx, ry] = rig.head
  const P = (u, v) => [cx + u * rx, cy + v * ry]
  return {
    P,
    poly: (c, pts, part) => poly(c, pts.map(([u, v]) => P(u, v)), part),
    ellipse: (c, u, v, ru, rv, part) => ellipse(c, cx + u * rx, cy + v * ry, ru * rx, rv * ry, part),
    rect: (c, u0, v0, u1, v1, part) => rectC(c, cx + u0 * rx, cy + v0 * ry, cx + u1 * rx, cy + v1 * ry, part)
  }
}

// ------------------------------------------------------------ peinados
const HAIR = {
  goku (c, H) {
    H.ellipse(c, 0, -0.52, 1.18, 0.62, 'hair')
    const spikes = [
      [[-0.7, -0.9], [-0.05, -1.12], [-1.0, -2.15]],
      [[-0.2, -1.1], [0.5, -1.05], [0.35, -2.35]],
      [[0.3, -1.0], [0.95, -0.7], [1.65, -1.75]],
      [[0.85, -0.85], [1.1, -0.2], [2.05, -0.95]],
      [[1.0, -0.45], [1.12, 0.25], [1.95, 0.05]],
      [[-0.85, -0.8], [-1.1, -0.2], [-2.05, -0.95]],
      [[-1.0, -0.45], [-1.12, 0.25], [-1.95, 0.05]],
      [[-0.65, -0.35], [-0.2, -0.35], [-0.5, 0.2]],
      [[-0.15, -0.35], [0.3, -0.35], [0.1, 0.15]],
      [[0.3, -0.35], [0.75, -0.35], [0.62, 0.22]]
    ]
    for (const s of spikes) H.poly(c, s, 'hair')
    H.rect(c, -1.08, -0.3, -0.88, 0.45, 'hair')
    H.rect(c, 0.88, -0.3, 1.08, 0.45, 'hair')
  },
  gohan (c, H) {
    H.ellipse(c, 0, -0.5, 1.15, 0.62, 'hair')
    for (const s of [
      [[-0.55, -1.0], [0.1, -1.12], [-0.4, -1.85]],
      [[0.0, -1.1], [0.6, -0.95], [0.65, -1.75]],
      [[0.7, -0.8], [1.08, -0.3], [1.55, -0.95]],
      [[-0.8, -0.8], [-1.08, -0.3], [-1.55, -0.95]],
      [[-0.25, -0.35], [0.3, -0.35], [0.05, 0.3]]
    ]) H.poly(c, s, 'hair')
    H.rect(c, -1.06, -0.3, -0.9, 0.35, 'hair')
    H.rect(c, 0.9, -0.3, 1.06, 0.35, 'hair')
  },
  vegeta (c, H) {
    H.poly(c, [
      [-1.05, 0.15], [-1.12, -0.8], [-0.8, -1.55], [-0.55, -2.25], [-0.25, -1.95], [0, -2.7], [0.25, -1.95],
      [0.55, -2.25], [0.8, -1.55], [1.12, -0.8], [1.05, 0.15], [0.85, -0.25], [0.45, -0.4], [0.12, -0.35],
      [0, -0.1], [-0.12, -0.35], [-0.45, -0.4], [-0.85, -0.25]
    ], 'hair')
  },
  bulma (c, H) {
    H.ellipse(c, 0, -0.4, 1.22, 0.78, 'hair')
    H.poly(c, [[-1.22, -0.4], [-0.8, -0.3], [-0.85, 1.0], [-1.3, 0.9]], 'hair')
    H.poly(c, [[1.22, -0.4], [0.8, -0.3], [0.85, 1.0], [1.3, 0.9]], 'hair')
    H.poly(c, [[-0.75, -0.4], [0.2, -0.45], [-0.2, -0.14], [-0.55, -0.1]], 'hair')
    H.poly(c, [[0.15, -0.45], [0.8, -0.35], [0.7, -0.12], [0.35, -0.16]], 'hair')
  },
  chichi (c, H) {
    H.ellipse(c, 0, -0.45, 1.16, 0.7, 'hair')
    H.ellipse(c, 0, -1.28, 0.5, 0.38, 'hair')
    H.rect(c, -0.7, -0.4, 0.7, -0.22, 'hair')
    H.rect(c, -1.12, -0.3, -0.9, 0.7, 'hair')
    H.rect(c, 0.9, -0.3, 1.12, 0.7, 'hair')
  },
  turban (c, H) {
    H.ellipse(c, 0, -0.62, 1.2, 0.78, 'turban')
    H.rect(c, -1.1, -0.25, 1.1, -0.05, 'turban')
    H.ellipse(c, 0, -0.95, 0.35, 0.22, 'under')
  },
  bald () {},
  krilin (c, H) {
    for (const [u, v] of [[-0.3, -0.72], [0, -0.78], [0.3, -0.72], [-0.3, -0.48], [0, -0.52], [0.3, -0.48]]) H.rect(c, u - 0.04, v, u + 0.04, v + 0.05, 'dots')
  }
}

// ------------------------------------------------------------ caras
function face (c, H, spec) {
  const kind = spec.face || 'happy'
  const brow = spec.browColor || 'hair'
  const eye = (u, stern) => {
    const inner = u < 0 ? 1 : -1 // la pupila mira hacia el centro
    if (stern) {
      H.rect(c, u - 0.2, 0.14, u + 0.2, 0.3, 'white')
      H.rect(c, u + inner * 0.02, 0.14, u + inner * 0.2, 0.3, 'eye')
      H.poly(c, [[u - 0.32, -0.08], [u + 0.32, -0.08], [u + (u < 0 ? 0.32 : -0.32), 0.14]], brow)
      return
    }
    H.rect(c, u - 0.21, 0.04, u + 0.21, 0.46, 'white')
    H.rect(c, Math.min(u + inner * 0.02, u + inner * 0.21), 0.12, Math.max(u + inner * 0.02, u + inner * 0.21), 0.46, 'eye')
    H.rect(c, u - 0.23, -0.02, u + 0.23, 0.06, 'eye') // párpado
    H.rect(c, u - 0.24, -0.2, u + 0.22, -0.11, brow) // ceja
  }
  if (kind === 'glasses') {
    H.rect(c, -0.75, 0.05, 0.75, 0.38, 'glasses')
  } else {
    eye(-0.38, kind === 'stern')
    eye(0.38, kind === 'stern')
  }
  if (kind === 'happy') {
    // sonrisa amplia con dientes, comisuras hacia arriba
    H.rect(c, -0.36, 0.6, 0.36, 0.76, 'mouth')
    H.rect(c, -0.3, 0.62, 0.3, 0.7, 'white')
    H.rect(c, -0.46, 0.54, -0.34, 0.62, 'mouth')
    H.rect(c, 0.34, 0.54, 0.46, 0.62, 'mouth')
  } else {
    H.rect(c, -0.18, 0.7, 0.18, 0.74, 'mouth')
  }
}

// ------------------------------------------------------------ cuerpo
function body (c, rig, spec) {
  const [cx] = rig.head
  const [top, bottom, sh, wa] = rig.torso
  const [legTop, legBottom] = rig.legs
  const [bootTop, bootBottom] = rig.boots
  const armColor = spec.sleeves === 'long' ? 'under' : 'skin'
  const fistColor = spec.gloves ? 'gloves' : 'skin'
  const r = rig.arm

  // detrás del cuerpo
  if (spec.cape) poly(c, [[cx - sh - 1, top + 1], [cx + sh + 1, top + 1], [cx + sh + 5, bootBottom], [cx - sh - 5, bootBottom]], 'cape')
  if (spec.shell) ellipse(c, cx, (top + bottom) / 2, sh + 2, (bottom - top) / 2 + 1, 'shell')
  if (spec.pole) {
    capsule(c, cx - sh - 5, top - 9, cx + sh - 2, bottom, 1.1, 'pole')
    capsule(c, cx - sh - 5, top - 9, cx - sh - 4, top - 7, 1.2, 'poleEnd')
  }
  if (spec.staff) capsule(c, cx + sh + 5, top - 2, cx + sh + 5, bootBottom, 0.9, 'staff')

  // piernas
  if (spec.outfit === 'dress' || spec.outfit === 'shorts') {
    rect(c, cx - 5, legTop, cx - 2, bootTop, 'skin')
    rect(c, cx + 2, legTop, cx + 5, bootTop, 'skin')
  } else {
    // pantalón ancho estilo gi: se abomba y se recoge sobre la bota
    const mid = (legTop + bootTop) / 2 + 2
    poly(c, [[cx - wa - 1, legTop], [cx, legTop], [cx - 0.5, bootTop + 1], [cx - wa - 1, bootTop + 1], [cx - wa - 4, mid]], 'pants')
    poly(c, [[cx, legTop], [cx + wa + 1, legTop], [cx + wa + 4, mid], [cx + wa + 1, bootTop + 1], [cx + 0.5, bootTop + 1]], 'pants')
    rectC(c, cx - 0.5 / SCALE, legTop + 3, cx + 0.5 / SCALE, bootTop + 1, 'line')
  }
  if (spec.outfit === 'shorts') {
    poly(c, [[cx - wa, legTop - 1], [cx + wa, legTop - 1], [cx + wa + 1, legTop + 5], [cx - wa - 1, legTop + 5]], 'pants')
  }
  // botas
  const bw = spec.outfit === 'dress' || spec.outfit === 'shorts' ? 4 : 5
  rect(c, cx - bw - 4, bootTop, cx - 1, bootBottom, 'boots')
  rect(c, cx + 1, bootTop, cx + bw + 4, bootBottom, 'boots')
  if (spec.cuffs) {
    rect(c, cx - bw - 4, bootTop, cx - 1, bootTop, 'cuff')
    rect(c, cx + 1, bootTop, cx + bw + 4, bootTop, 'cuff')
  }

  // torso
  if (spec.outfit === 'dress') {
    poly(c, [[cx - sh + 2, top], [cx + sh - 2, top], [cx + wa + 4, legTop + 7], [cx - wa - 4, legTop + 7]], 'top')
  } else {
    poly(c, [[cx - sh, top], [cx + sh, top], [cx + wa + 1, bottom], [cx - wa - 1, bottom]], 'top')
  }
  if (spec.vneck) poly(c, [[cx - 4, top], [cx + 4, top], [cx, top + 6]], 'under')
  if (spec.pads) {
    ellipse(c, cx - sh, top + 1.5, 3, 2.2, 'pad')
    ellipse(c, cx + sh, top + 1.5, 3, 2.2, 'pad')
  }
  if (spec.sash) {
    rect(c, cx - wa - 1, bottom - rig.sash + 1, cx + wa + 1, bottom + 1, 'sash')
    if (spec.knot) poly(c, [[cx - 1, bottom], [cx + 2, bottom], [cx + 3, bottom + 7], [cx - 2, bottom + 7]], 'sash')
  }
  if (spec.logo) rect(c, cx - 2, top + 4, cx + 1, top + 6, 'white')
  if (spec.cape) {
    ellipse(c, cx - sh, top + 1, 3.2, 2.2, 'cape')
    ellipse(c, cx + sh, top + 1, 3.2, 2.2, 'cape')
  }

  // brazos (mangas cortas del color del torso)
  const armTop = top + 2
  const handY = bottom + 2
  for (const side of [-1, 1]) {
    const sx = cx + side * (sh - 0.5)
    const hx = cx + side * (sh + 2.5)
    const sleeve = spec.sleeves !== 'long' && spec.sleeves !== 'none'
    // trazo oscuro alrededor del brazo para separarlo del torso
    capsule(c, sx, armTop, hx, handY - 2, r + 0.9, 'line')
    if (sleeve) capsule(c, sx, armTop, sx + side * 1.5, armTop + 5, r + 1.5, 'line')
    ellipse(c, hx, handY, r + 1.5, r + 1.3, 'line')
    capsule(c, sx, armTop, hx, handY - 2, r, armColor)
    if (sleeve) capsule(c, sx, armTop, sx + side * 1.5, armTop + 5, r + 0.7, spec.pads ? 'pad' : 'top')
    if (spec.bands) rect(c, hx - r, handY - 4, hx + r, handY - 3, 'bands')
    ellipse(c, hx, handY, r + 0.6, r + 0.4, fistColor)
  }

  // delante
  if (spec.ball) {
    capsule(c, cx - sh + 2, top + 1, cx + wa + 2, bottom + 3, 0.5, 'strap')
    ellipse(c, cx + wa + 2.5, bottom + 4.5, 2.6, 2.6, 'ball')
    set(c, cx + wa + 2, bottom + 4, 'star')
    set(c, cx + wa + 3, bottom + 5, 'star')
  }
}

// ------------------------------------------------------------ cabezas
function head (c, rig, spec) {
  const H = headSpace(rig)
  const [cx, cy, rx, ry] = rig.head
  if (spec.head === 'pig') {
    ellipse(c, cx, cy, rx + 1, ry, 'skin')
    H.poly(c, [[-0.9, -0.6], [-0.4, -0.9], [-0.95, -1.5]], 'skin')
    H.poly(c, [[0.9, -0.6], [0.4, -0.9], [0.95, -1.5]], 'skin')
    H.ellipse(c, 0, 0.45, 0.45, 0.3, 'snout')
    H.rect(c, -0.2, 0.42, -0.1, 0.5, 'eye')
    H.rect(c, 0.1, 0.42, 0.2, 0.5, 'eye')
    H.rect(c, -0.5, -0.05, -0.35, 0.15, 'eye')
    H.rect(c, 0.35, -0.05, 0.5, 0.15, 'eye')
    return
  }
  if (spec.head === 'cat') {
    ellipse(c, cx, cy, rx + 0.5, ry, 'skin')
    H.poly(c, [[-0.95, -0.4], [-0.35, -0.85], [-0.95, -1.45]], 'skin')
    H.poly(c, [[0.95, -0.4], [0.35, -0.85], [0.95, -1.45]], 'skin')
    H.rect(c, -0.5, 0.05, -0.25, 0.15, 'eye')
    H.rect(c, 0.25, 0.05, 0.5, 0.15, 'eye')
    H.rect(c, -0.1, 0.35, 0.1, 0.45, 'snout')
    H.rect(c, -1.3, 0.45, -0.6, 0.5, 'whisker')
    H.rect(c, 0.6, 0.45, 1.3, 0.5, 'whisker')
    return
  }
  // orejas y cara humana (con trazo oscuro que separa barbilla y cuello)
  ellipse(c, cx, cy + 0.5, rx + 0.9, ry + 0.9, 'line')
  ellipse(c, cx - rx, cy + 1, 1.6, 2.2, 'skin')
  ellipse(c, cx + rx, cy + 1, 1.6, 2.2, 'skin')
  ellipse(c, cx, cy, rx, ry, 'skin')
  if (spec.antennae) {
    capsule(c, cx - 2, cy - ry, cx - 4, cy - ry - 4, 0.6, 'skin')
    capsule(c, cx + 2, cy - ry, cx + 4, cy - ry - 4, 0.6, 'skin')
  }
  face(c, H, spec)
  if (spec.beard) {
    H.poly(c, [[-0.85, 0.5], [0.85, 0.5], [0.55, 1.25], [0, 2.1], [-0.55, 1.25]], 'beard')
    H.rect(c, -0.5, 0.52, 0.5, 0.62, 'beard')
  }
  HAIR[spec.hair || 'bald'](c, H)
}

// ------------------------------------------------------------ dinosaurio (especial)
function dino (c) {
  capsule(c, 30, 40, 42, 52, 3, 'top') // cola
  ellipse(c, 22, 38, 12, 11, 'top') // cuerpo
  ellipse(c, 21, 40, 7, 8, 'under') // barriga
  ellipse(c, 18, 16, 10, 8, 'top') // cabeza
  poly(c, [[8, 18], [26, 18], [26, 24], [10, 23]], 'top') // mandíbula
  for (let x = 10; x < 25; x += 3) poly(c, [[x, 19], [x + 2, 19], [x + 1, 21]], 'white') // dientes
  rect(c, 14, 12, 16, 14, 'eye')
  set(c, 14, 12, 'white')
  capsule(c, 18, 24, 18, 30, 3, 'top') // cuello
  capsule(c, 12, 33, 7, 38, 1.6, 'top') // brazos
  capsule(c, 30, 33, 34, 37, 1.6, 'top')
  rect(c, 12, 46, 19, 55, 'top') // piernas
  rect(c, 24, 46, 31, 55, 'top')
  rect(c, 10, 55, 20, 58, 'boots')
  rect(c, 23, 55, 33, 58, 'boots')
}

// ------------------------------------------------------------ sombreado + contorno
const NO_SHADE = new Set(['eye', 'white', 'mouth', 'star', 'glasses', 'dots', 'whisker', 'line'])

function shadeHex (hex, k) {
  const n = parseInt(hex.slice(1), 16)
  const f = v => Math.max(0, Math.min(255, Math.round(v * k)))
  return '#' + [n >> 16, (n >> 8) & 255, n & 255].map(v => f(v).toString(16).padStart(2, '0')).join('')
}

export function buildSprite (spec) {
  const c = canvas()
  const rig = RIGS[spec.build || 'kid']
  if (spec.build === 'dino') dino(c)
  else {
    body(c, rig, spec)
    head(c, rig, spec)
  }
  const colors = { ...DEFAULT_COLORS, ...(spec.colors || {}) }
  const px = c.px
  // sombra: 1-2 px en los bordes derecho/inferior de cada pieza (luz arriba-izquierda)
  const tone = px.map((p, i) => {
    if (!p || NO_SHADE.has(p)) return p
    const x = i % SPRITE_W; const y = Math.floor(i / SPRITE_W)
    const edge = (dx, dy) => get(c, x + dx, y + dy) !== p
    if (edge(1, 0) || edge(0, 1) || edge(1, 1) || edge(2, 0) || edge(0, 2) || edge(3, 0)) return p + ':d'
    if (edge(-1, 0) || edge(0, -1)) return p + ':l'
    return p
  })
  // contorno exterior oscuro
  const out = tone.map((p, i) => {
    if (p) return p
    const x = i % SPRITE_W; const y = Math.floor(i / SPRITE_W)
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (get(c, x + dx, y + dy)) return 'outline'
    return null
  })
  // paleta compacta con claves de un carácter
  const KEYS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const palette = {}
  const keyOf = {}
  const colorOf = t => {
    if (t === 'outline' || t === 'line') return spec.outline || '#141020'
    const [part, mod] = t.split(':')
    const base = colors[part] || '#ff00ff'
    return mod === 'd' ? shadeHex(base, 0.72) : mod === 'l' ? shadeHex(base, 1.12) : base
  }
  const grid = []
  for (let y = 0; y < SPRITE_H; y++) {
    let row = ''
    for (let x = 0; x < SPRITE_W; x++) {
      const t = out[y * SPRITE_W + x]
      if (!t) { row += '.'; continue }
      const hex = colorOf(t)
      if (!keyOf[hex]) {
        keyOf[hex] = KEYS[Object.keys(palette).length]
        palette[keyOf[hex]] = hex
      }
      row += keyOf[hex]
    }
    grid.push(row)
  }
  return trim({ grid, palette })
}

// recorta filas/columnas vacías (manteniendo el personaje centrado en X)
function trim ({ grid, palette }) {
  let top = grid.findIndex(r => /[^.]/.test(r))
  let bottom = grid.length - 1 - [...grid].reverse().findIndex(r => /[^.]/.test(r))
  if (top < 0) { top = 0; bottom = grid.length - 1 }
  let left = SPRITE_W; let right = 0
  for (const r of grid) {
    const a = r.search(/[^.]/)
    if (a >= 0) { left = Math.min(left, a); right = Math.max(right, r.length - 1 - [...r].reverse().findIndex(ch => ch !== '.')) }
  }
  const half = Math.max(SPRITE_W / 2 - left, right + 1 - SPRITE_W / 2)
  const x0 = Math.max(0, Math.floor(SPRITE_W / 2 - half))
  const x1 = Math.min(SPRITE_W, Math.ceil(SPRITE_W / 2 + half))
  return { grid: grid.slice(top, bottom + 1).map(r => r.slice(x0, x1)), palette }
}

// Opciones que ofrece el editor (Diseño)
export const SPEC_OPTIONS = {
  build: ['kid', 'short', 'adult', 'slim', 'dino'],
  hair: Object.keys(HAIR),
  head: ['human', 'pig', 'cat'],
  face: ['happy', 'calm', 'stern', 'glasses'],
  outfit: ['gi', 'dress', 'shorts'],
  sleeves: ['short', 'long', 'none'],
  extras: ['vneck', 'sash', 'knot', 'bands', 'cuffs', 'pole', 'ball', 'cape', 'pads', 'shell', 'staff', 'beard', 'antennae', 'gloves', 'logo'],
  colors: Object.keys(DEFAULT_COLORS)
}
export const EXTRA_LABELS = {
  vneck: 'Cuello en V', sash: 'Cinturón', knot: 'Nudo del cinturón', bands: 'Muñequeras', cuffs: 'Borde de botas',
  pole: 'Báculo sagrado', ball: 'Esfera colgante', cape: 'Capa', pads: 'Hombreras', shell: 'Caparazón',
  staff: 'Bastón', beard: 'Barba', antennae: 'Antenas', gloves: 'Guantes', logo: 'Logotipo'
}
export const COLOR_LABELS = {
  skin: 'Piel', hair: 'Pelo', eye: 'Ojos', white: 'Blanco ojos', mouth: 'Boca', top: 'Torso', under: 'Camiseta',
  sash: 'Cinturón', pants: 'Pantalón', boots: 'Botas', cuff: 'Borde botas', bands: 'Muñequeras', gloves: 'Guantes',
  pole: 'Báculo', poleEnd: 'Punta báculo', strap: 'Correa', ball: 'Esfera', star: 'Estrellas', cape: 'Capa',
  pad: 'Hombreras', turban: 'Turbante', beard: 'Barba', glasses: 'Gafas', shell: 'Caparazón', staff: 'Bastón',
  snout: 'Hocico', dots: 'Puntos', whisker: 'Bigotes'
}
export const DEFAULTS = DEFAULT_COLORS

// ------------------------------------------------------------ personajes
// build: kid | short | adult | slim | dino · hair: goku | gohan | vegeta | bulma | chichi | turban | krilin | bald
// face: happy | calm | stern | glasses · outfit: gi | dress | shorts
// Extras: vneck, sash, knot, bands, cuffs, pole, ball, cape, pads, shell, staff, beard, antennae, gloves, logo
// sleeves: short | long | none · colors: { pieza: '#hex' } (ver DEFAULT_COLORS)
export const CHARACTER_SPECS = {
  goku: {
    name: 'Son Goku', build: 'kid', hair: 'goku', face: 'happy', outfit: 'gi',
    vneck: true, sash: true, knot: true, bands: true, cuffs: true, pole: true, ball: true,
    colors: { top: '#3f4ea8', pants: '#3f4ea8', under: '#2d6fb5', sash: '#c9cdd8', bands: '#d6333a', boots: '#8a4a2a', cuff: '#d9c9a8' }
  },
  gohan: {
    name: 'Son Gohan', build: 'kid', hair: 'gohan', face: 'happy', outfit: 'gi',
    vneck: true, sash: true, knot: true, bands: true, cuffs: false,
    colors: { top: '#6a3fa0', pants: '#6a3fa0', under: '#6a3fa0', sash: '#d6333a', bands: '#d6333a', boots: '#7c4a22' }
  },
  krilin: {
    name: 'Krilin', build: 'short', hair: 'krilin', face: 'calm', browColor: 'eye', outfit: 'gi',
    vneck: true, sash: true, knot: true, bands: true, cuffs: false,
    colors: { top: '#f47b20', pants: '#f47b20', under: '#2250b8', sash: '#2250b8', bands: '#2250b8', boots: '#2250b8', dots: '#8a5a3a' }
  },
  vegeta: {
    name: 'Vegeta', build: 'adult', hair: 'vegeta', face: 'stern', outfit: 'gi',
    sleeves: 'long', gloves: true, pads: true, sash: false,
    colors: { top: '#f2f2f2', under: '#2a4fb0', pants: '#2a4fb0', boots: '#f2f2f2', pad: '#e8c14a', gloves: '#f2f2f2' }
  },
  piccolo: {
    name: 'Piccolo', build: 'adult', hair: 'turban', face: 'stern', outfit: 'gi',
    sleeves: 'none', sash: true, knot: false, bands: true, cape: true, antennae: false,
    colors: { skin: '#5fbf4a', top: '#5a3a9a', pants: '#5a3a9a', sash: '#3b6fd6', bands: '#d6333a', boots: '#7c4a22', under: '#5a3a9a', cape: '#f2f2f2', turban: '#f2f2f2' }
  },
  bulma: {
    name: 'Bulma', build: 'slim', hair: 'bulma', face: 'calm', outfit: 'dress', logo: true, sleeves: 'none',
    colors: { hair: '#4fc3cf', top: '#f29ec0', boots: '#b04a2a', mouth: '#c0484a' }
  },
  roshi: {
    name: 'Maestro Roshi', build: 'short', hair: 'bald', face: 'glasses', browColor: 'beard', outfit: 'shorts', beard: true, shell: true, staff: true,
    colors: { top: '#f47b20', pants: '#8a5a2b', boots: '#7c4a22', shell: '#7a4bb0' }
  },
  chichi: {
    name: 'Chichí', build: 'slim', hair: 'chichi', face: 'calm', outfit: 'dress', sash: true, sleeves: 'none',
    colors: { top: '#7a4bb0', sash: '#f6d33c', boots: '#7c4a22', mouth: '#c0484a' }
  },
  oolong: {
    name: 'Oolong', build: 'short', head: 'pig', outfit: 'gi', sash: true, vneck: false,
    colors: { skin: '#f4a3c4', top: '#3f8a4a', pants: '#2a4fb0', sash: '#f6d33c', boots: '#7c4a22', snout: '#e07aa5' }
  },
  karin: {
    name: 'Karin', build: 'short', head: 'cat', outfit: 'gi', staff: true, sleeves: 'none',
    colors: { skin: '#f4f4f4', top: '#f4f4f4', pants: '#f4f4f4', boots: '#e8e8e8', snout: '#f29ec0', staff: '#8a5a2b' }
  },
  dino: {
    name: 'Dinosaurio glotón', build: 'dino',
    colors: { top: '#4caf50', under: '#e8d36a', boots: '#2f7d32' }
  }
}

// Sprites generados listos para el juego: { name, grid, palette, spec }
export const CHARACTERS = Object.fromEntries(Object.entries(CHARACTER_SPECS).map(([id, spec]) => {
  const { grid, palette } = buildSprite(spec)
  return [id, { name: spec.name, color: spec.colors?.top, grid, palette, spec }]
}))

// Grupos para la galería de personajes (Admin → Personajes)
export const CHARACTER_GROUPS = [
  { name: 'Protagonistas', ids: ['goku', 'gohan', 'krilin', 'vegeta', 'piccolo', 'bulma'] },
  { name: 'Secundarios', ids: ['roshi', 'chichi', 'oolong', 'karin'] },
  { name: 'Rivales', ids: ['dino'] }
]
