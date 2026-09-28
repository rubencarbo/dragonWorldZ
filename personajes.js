// PERSONAJES — sprites de los protagonistas (SPRITES, estilo Dragon Ball Z) y
// generador de sprites pixel-art estilo anime (contorno oscuro,
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
  karin: {
    name: 'Karin', build: 'short', head: 'cat', outfit: 'gi', staff: true, sleeves: 'none',
    colors: { skin: '#f4f4f4', top: '#f4f4f4', pants: '#f4f4f4', boots: '#e8e8e8', snout: '#f29ec0', staff: '#8a5a2b' }
  },
  dino: {
    name: 'Dinosaurio glotón', build: 'dino', ref: 58,
    colors: { top: '#4caf50', under: '#e8d36a', boots: '#2f7d32' }
  }
}

// Sprites de los protagonistas (pixel-art estilo Dragon Ball Z). Goku y sus
// transformaciones (y Goku niño) proceden de las imágenes de referencia; Gohan, Krilin,
// Vegeta y Piccolo están editados a partir del sprite de Goku (mismo cuerpo,
// paleta y cabeza redibujada). Bulma es provisional.
export const SPRITES = {
  freezer: {
    palette: {a: '#b084bf', b: '#502e61', c: '#3e1d54', d: '#efc4f9', e: '#fdf9fe', f: '#140d21', g: '#f6f1fd', h: '#50507a', i: '#d8d8e1', j: '#9195a9', k: '#0b0615', l: '#c6c7d2', m: '#c8a3d8', n: '#fefffe', o: '#f6f8f8', p: '#f9fcfe', q: '#403b4a', r: '#ebe9f1', s: '#b5b9c7', t: '#020107', u: '#81849b', v: '#03020f', w: '#231a2e', x: '#73768d', y: '#312b3c', z: '#a3a6b5', A: '#acb1be', B: '#682f85'},
    grid: [
      '.......................................aamaaaaa......................',
      '....................................bauddddmaaaaa....................',
      '.....................................mddgdmu.B.mm.x..................',
      '..................................qbdbdddduBBBBB.dd..................',
      '..................................wd.bBBBBBBBBBBBBBdb................',
      '..................................k.AsmcbBBBBBBBBBBbdb...............',
      '................................qwuAegeesyb..BccccBBBc...............',
      '................................qysennoonni.cccccccBB.b..............',
      '...............................yqjspennnnnniucccccccBBcb.............',
      '...............................y.szsoonnnnnorjccccccbbwb.............',
      '...............................y.AAzAApppeonnrAcccccc.wb.............',
      '...............................yquAAAAlsponnoprzccccc.wq.............',
      '...............................yyujsAAzAioironpruccccbfy.............',
      '...............................qy.uiiisAAlironoei.ccc.yq.............',
      '................................qyApnolsAArononngl...xqq.............',
      '................................qyeiinpzsjliirrnepnngf...............',
      '................................qqrywgoAsyyyy.Aggoneswq..............',
      '................................yyzycwpxsAqusuwylAnsqf...............',
      '................................yysswwsxpni.xegqv.swf................',
      'ywwbb.............................fllixspnprszsgpnz.f................',
      'fiees.bbbb.........................kkuuApnirpnoennek.................',
      '.kAeggegrz.b..................ccccffxxxlpoiiopnnrAv..................',
      '..fksggeeegg.................cc.BB.xAxuusrirposA.kk..................',
      '..q.qqzinneeidc.............bbaxBBB.AzAusjzipgi.fcww.................',
      '....qq..ulonngm............cbaaBbBB.rAlzuzAAslljuccyy................',
      '..........xnppez...........c.aBbcc.aiiiisiAzjzsAijxbf................',
      '........qwyAropeu..........cbBbcb.uglrponpilAuzlgel.f................',
      '...........wjooee..........w.cccbuerrsopneeersjrnoelk................',
      '............tnpoes.........kmccbjgrAzgnnnneenngApoonv................',
      '............ksnnno.........kxzreizuAszpnnoonpprupnpAv................',
      '.............tpnpnl.q.....tpznpnlAAxuAzzonszAzuquszAlfq..............',
      '.............tpnnnnuy.....tnApnopplxAnnpnppgzcbgwwpzAlqq.............',
      '.............tlrnnnxw.....vpApppijfsAzopnnAAsa.cbbAsszyq.............',
      '.............tAppnp.w....tjzxrpl.vkusAzposinnedbwgluzzy..............',
      '.............tssnpl.w...kAAsxAlz.wqfuuxuArepneegzeuuuuyfy............',
      '............w.sAlsA.y..ylrrAisA.qq..wwuusrnnnnneznzuuhxu.............',
      '............kAAAzAz.y.yzeplior.q....qqyujgppnpopAnijuxhjz............',
      '...........y.zzlz....qwennlnop.y....yykzjlrnnnnpiip.ujjjjz.y..yyyy...',
      '..........qqjAss....qqwrpnponr.q....yqvsllrnpppnpsp.jzAjzAAyqqy..qq..',
      '..........qAxAAAkinuyyyArnnpnsyy..qwustAnpnnpprnpnrnuAAszAzxwyusAzyq.',
      '........qyjjuusAklpoisoAxorpgzqy..wsAsfspnpnnrsnpoznksAAssz.uAAAjuyq.',
      '.........zuxuuuu.wxinnnpAuxplfq.yyAAssxppnnppnrAgAAgussAAz.xszsAfvvq.',
      '......w.zuuuuuj..kxAAlppsxslv....sAAAxxnnopnpppAqspnvxsszuuussluusjqy',
      '.....wujuxuuujv.vAAjxuzAxspv..w.sAAAxxzgnnnlipgsxAnlvvv.uuuhuuhuusz.y',
      '.....fxjjssujk..trszAuuAszpk.vjssAAxsxpzoonlirz.xzpv.....sjuhhhhkxA.w',
      '....v.AzAAssf...kiolxuzxAAlvvsssszusuuprpnnlii.uAput....qwuxhhhslftq.',
      '....fjAsAssAv...krnizuszxsjvAzAAjjAuufnrrpliiz.uAst.....qqAxhsxlAw...',
      '....fjsAlgrrt.....srzqrrzsujyzzAAzuuuvloosulAxhusjt.....qqAu.sA.jw...',
      '....fujloonnxww.....qylprAijvzsAzjuxA..psiisjxxhxuk......q.zzqjxyq...',
      '....qqulnoppiu.......u.louiq.zzzjjuzzq.isrozuxxxuqy.......wAzk.qy....',
      '.....kulpppponl.....ul.uA.x.szzujjjz.klzsiiuhxhjuy........yx.ffw.....',
      '.....y.srneeerepoooopgiwyyyAzzjjjAzxfvljsju.xuxAv..........ww........',
      '........loeenznornppprzsAzzzAuAsszxk.fspgpsuxuu.v....................',
      '.........lnnenzAzzAAAAAAAAAuuzAAAxf.kAnzAmgsuuu.f....................',
      '........yttzpopppsAAAAssssAsssjyvw..vszsy.jjuxyf.....................',
      '...........ktxsAAsAAAAsssllukvvq....ksAAcbzjjxyk.....................',
      '............xkvvxuzlssAufvtt........kssAbB.xxbw......................',
      '................fktvvkvf............tsAsbaxxhyf......................',
      '.....................................kss.axxhyf......................',
      '.....................................tssyz.h.yf......................',
      '....................................wvlAuAzx..ywwww..................',
      '...................................yxjizislszu.....q.................',
      '...................................kiAslsuilzjjujl.fq................',
      '...................................ve..Axujuxurxusqqk................',
      '...................................wrggkrr.jrizquxlxk................'
    ]
  },
  a17: {
    palette: {a: '#130823', b: '#424462', c: '#3c3351', d: '#1c112e', e: '#2f2544', f: '#eb7936', g: '#251737', h: '#e3dfc8', i: '#2c0509', j: '#381b25', k: '#bb4d2a', l: '#522d35', m: '#803438', n: '#0a0313', o: '#848697', p: '#151d7b', q: '#080c50', r: '#a87d66', s: '#486dd1', t: '#3951bd', u: '#79a7f9', v: '#aab7ca', w: '#6c9aea', x: '#353d86', y: '#4562ea', z: '#1220b1', A: '#b8b58e', B: '#f2f3f5'},
    grid: [
      '.............dgddaad.aaa...................',
      '............eggccegagaggdd.................',
      '...........cdcecccceddaddgge...............',
      '..........cdecc.ccceeaddaddde..............',
      '.........bgebc..bcceeegaaddgde.............',
      '........bgecc..bccccccegadgegag............',
      '.........dbccoc...ccccddgaanddda...........',
      '.......cagccccc.....bcccggadadgdd..........',
      '........accccdcce..ccdgccendggdgdn.........',
      '........acggcgcccecccgggdcgadgdaga.........',
      '.......bacgggdeggecccdnnngdadaadga.........',
      '........acgggggggecegnnnnadnddnadn.........',
      '........acgggggggeeejrrrriiiaanadn.........',
      '........acgggggggeelmrrrrrrr.jaadn.........',
      '........acgggggggcejrrrrrrrrrlaadn.........',
      '........acgggggggeejrrrrrrrrrldadn.........',
      '........acgggggggeee...rrrrrrldadn.........',
      '........acgggggggeegddgarrrrjjaadn.........',
      '........acgaggaggeeggaegnrArlndadn.........',
      '.......cncgaggadgee.hhBnjirrjaddniiinn.....',
      '......laacdnggdggeeloBBjrAhrmlddirkkri.....',
      '.....jjliggagdngggd.hhhrrhhrmjdlkkmri......',
      '.....ljmmjgaggagggdlhhhhhhhhrlilkmri.......',
      '.....jjmmijaggagggd.hhrhhhrriimkmmi........',
      '......ljmmj.jimjggglAhhrrrmiilmmmi.........',
      '.......lijimmmmjggglrAhhrmkmmljija.........',
      '......cgeaimmmkmjgjlmrrkfkmmllgddn.........',
      '.....ceagdikmkkmmlmmkfkkkklleceeeej........',
      '.....eaggdikmkkkkkkfkfkkkmjcceeeccac.......',
      '.....jaddaimkkfffffffkfkrjcccccececn.......',
      '.....gc.adaiffkkkfffffffilcgeeececca.......',
      '.....c.o.anifkffffffkffimljggeeeeova.......',
      '....e.vvvoniffkkkkkkffimmilgaeeevohBa......',
      '..qqooovvooikffkkkkfriclccgnnn.vohBBd......',
      '.qvBBhvbbonjikffffkijc.ecdcn..c.hBBBBq.....',
      'avvhhvAo.nndgikfkmjjccddgcba..cbhBBBBBp....',
      'avhhhhhhhvvndalijjdecdgdecgab..cghBBhBp....',
      '.bhvhvvvhvoojgdejjeegggjjed.....cgBhBBvx...',
      '.dvvvvhvoorAmg.crArlc.lledc......aBhhBBx...',
      '.c.vvvvorrAhrloorAAm.o...a.......nBhhBBo...',
      '..noovArrAhho.wooooo.vo.oa.......joBBBBBbc.',
      '..dovvArAhhostwyzssssuswwq........nBBBBB...',
      '...no.rAhhBxussyztssswussq........nhhBhBBoc',
      '....alrAhhotuwwuswuwtswuutq......nBhBBBBh.b',
      '....j.rAhhouwwuyztysuwwwusp......ahhBBhrh.e',
      '.....jlAhh.uwwsyzzzsuuuuuyup......nrrhhhhA.',
      '......ljABwwuuyztzxtsuwwutuzx....iAhhhhhhA.',
      '........ntuuutyyspqpuwwuuwuyzb...ihrrhhrhA.',
      '........qwutusyzqcbqsuwwuwuyzx...irAkhhrh..',
      '......cqtuusyyyqb..bpssuwwuspx...lirrhhrjl.',
      '......cpswsyztzq....bptswuswpb....ljrAhll..',
      '.....ccpsyytttpc.....cxssuywtxb....ll.rl...',
      '.....eqzyyyzytq.......qsswsswtxb....jjj....',
      '.....epzyyyyyzq.......asyyytusxe...........',
      '.....ppzyyyzzzq.......ausyyywsxe...........',
      '....dpzzyyzzzya.......avusyyyytpd..........',
      '....extzyyyyysd........asuuyyytpq..........',
      '...aobxsyyzzpq.........apzyyyyyyqn.........',
      '...nAAxptpppq...........qzzyyytpeon........',
      '...aAAhhhhhAn...........qppptpbvhhn........',
      '...arAAArrAhn...........nvhhhhhhAAn........',
      '...avhhhrrAj.............iArAhhhhcn........',
      '..ceovvohccn..............je..ovtpa........',
      '.joovvvswtpa..............nbovvvuwxe.......',
      'e.BBBBvwtsta..............nohBBBBBvn.......',
      'nBBBBBBBoovj..............nBBBBBBBBn.......',
      'nhhBBBBBhhn...............nvBBBBBBhn.......'
    ]
  },
  a18: {
    palette: {a: '#1e1863', b: '#d0c677', c: '#eadeae', d: '#f4f592', e: '#c8d460', f: '#c1d751', g: '#a2a250', h: '#e0e37c', i: '#867443', j: '#2b1114', k: '#be886c', l: '#101291', m: '#616ec6', n: '#4456e2', o: '#40354f', p: '#99a5af', q: '#fbe5c5', r: '#0b0948', s: '#c7d1d4', t: '#847c7e', u: '#f0f4f8', v: '#b9a290', w: '#242db3', x: '#0c0528', y: '#2d2237', z: '#201531', A: '#10030d', B: '#61302d'},
    grid: [
      '................aaaaa...................',
      '..............rapqqcsar.................',
      '.............apsqdddqcsaa...............',
      '............apcdddddddbtsaz.............',
      '...........ascddddddehggvivyyo..........',
      '..........atcdhhddddhdbbbggiioo.........',
      '..........xcdhheddddddhhdeggbi..........',
      '..........Bdhedhddddhdhebbhgfego........',
      '.........jhhedddhdddbddddddhgehvy.......',
      '.........Adedhedddddddddddddefhcpa......',
      '........yqeedefdddddddeggbeddhhdsa......',
      '........ydfedffdhhddbiiggggeddbgsa......',
      '........ydffeffdehdbiigggggghhggva......',
      '........ydfffffdehhbii.iggggbgiivx......',
      '........ydfffffeehhbi.kkkikgiiiitx......',
      '........ydfffffffhbi.kkkkkkkkkii.A......',
      '........ydfffffffhbk.ikkkkkkhbg.yo......',
      '........jdeffffffhbivbbbkkkbhgByj.......',
      '........jdeefffffhgivghbkkkhgioyj.......',
      '........jdegeffffhgoyovvv.kbBttoj.......',
      '........jdegffffehk.ssAAikk.Bt.jj.......',
      '.......ojeegefffehk.ssuj.kkkB.t.j.......',
      '.......ojhegeffffhv.yuujkqqkkkk.j.......',
      '.........AbgefgfehbvqccqqqcqvkiBj.......',
      '.........AcAhfgeehbvqqqqcqq.i.i.A.......',
      '.........xxAbegeehbivqqBkqktBBBy........',
      '.......orlaxgbgeehb...vqqvoo..oy........',
      '........rllrvcyteek...ammlnmm...x.......',
      '.......ormllmww.tbgktwlnnlnnnnnwty......',
      '.......ozpwwwnwatgk.wwwnwwnwwwnmpty.....',
      '........zpmwwnwotkk.llnnwnnwwwmpss......',
      '.......oatplnna.ttt.alnwnnnnwmsssus.....',
      '..oo.oaoarplnlooooooallnnnnnmsssssuuo...',
      '.auq.pqsprrlmaoooooaawllllnwrtpppsssur..',
      'ruqvkvvqqprmmazoooyawwlmurmr.z.sssuuuur.',
      'rvkkcqcvqspsarrzyzzawwwlrrxxAAAysssuusua',
      'xvkcqqcc.pspsaarxAAxrallrpquvvsuuuuuusuz',
      'xvkkqqqqu.sspptoojAAAroxvqqqqvvvsuuusux.',
      '.zkkkcviv.pssp.yovcvo.zvqqqqqcctpsuusx..',
      '..jkkkkt.tpsptxaatgta.xvvkiqcqqctssuy...',
      '...ytttttpps.zrllw.mnnaov.kkcqcctsuoo...',
      '...o.tpptpo.orlllwnnwww..vkkcqcvts.o....',
      '..........yxrawlllwnnnnnw.kkbvvvpty.....',
      '...........xalllllwnnnnnna.ttvvvpz......',
      '...........xalllllwwnnwwwwrxAtstz.......',
      '...........xaallwlllwwnnmmazzxAz........',
      '..........Aoozyxallwmmmrxzzooozx........',
      '.........Aotoozzzxxxxxxxzzoo..yy........',
      '.........A.toozzyzo....Azzoo..yz........',
      '........xotyozzyAo......xzooooyzz.......',
      '.....oAxzy.ozzzxo.......AzoooozzzA......',
      '....yzzzyoozyzz.........AzyooyzzzzA.....',
      '...yAzzzzyyzyxo.........oAzyyzzzzzA.....',
      '..yoyzzzzzzzzo...........ozyzyzyzzyy....',
      '..AoyyzzzzxzA.............Azzzzyzj.A....',
      '..A.BjzyzAjyA.............AyjAxzjjtA....',
      '..AB.Bjjjjj.A.............A.yjjjj..jo...',
      '..jj.....B.Bj.............jo......BBA...',
      '.ABBBBBBBBBA...............jyBB.BBBBBA..',
      'AjBB.BB.BBA.................jAjBBBBBBBA.',
      '....BBBByA....................BjB...BBA.',
      '.....BBBoA...................yj.......A.',
      '.......Bj....................yyBB...BBA.'
    ]
  },
  trunks: {
    palette: {a: '#392c3f', b: '#ba91d2', c: '#faf4f7', d: '#f9d4f7', e: '#edc8f0', f: '#caa8d2', g: '#b79294', h: '#422524', i: '#885e7e', j: '#9368b4', k: '#dcb692', l: '#d3d2de', m: '#444394', n: '#150409', o: '#7675c7', p: '#2d1212', q: '#4f48a9', r: '#fbdebf', s: '#2f2231', t: '#39327a', u: '#b87e67', v: '#3c3061', w: '#523b44', x: '#120e2e', y: '#251929', z: '#201521', A: '#190d19', B: '#1e1b49'},
    grid: [
      '....................................................ay..',
      '...........................jjbbb...................aaga.',
      '..........................jffdddfjjjj.............asil.a',
      '.........................fddddeeeebfb........w...as.flfn',
      '.......................jfedddeffeffbjbe...wiiiwsyza..c.A',
      '......................jfdddedgddddddbj.db.iiiiazyyaa....',
      '....................vjedddedddddedfbbbbddfiippsayyAAAA..',
      '...................abbeddegddeddddddeb.bddbzAzsasAy.....',
      '...................vbbbeefddeddddddddedbbddbyy.wa.......',
      '..................v.bbbbbdeddgddddddddddbdddfa.aa.......',
      '..................vjbbbbbbddfeddddddddeebdddbvvvay......',
      '..................vbbbjjbbfbbdddfjjjjfdeiddbbvt..ay.....',
      '..................yfbbjjbbbjbfffjijjjjfdifjjbbttvBs.....',
      '..................Afbbjjbbbjbbbjjiiijjjejbjjbbvvttvv....',
      '..................Afbbjjbfbjbbgiuuu.jjjbijjjjbvvmmmvw...',
      '..................ybbbjjbbfbbf.uuuugggii...jjbvvmmqmB...',
      '.................hpibbjjbbbjbf.uuugguugu..sjjbvvmmqmvx..',
      '...............ahuuijbjjjbbjbbiuuuguuuuug.sjjbvvtqqqmB..',
      '.............yBfkkui.jjjiibibf.uiugguuuggfajbf.BmqqqqvA.',
      '..........wh.fllkk.jjqojgrgifg.dddfuuuuggfBifaavtqqqq.x.',
      '........ahukkkfoBvjoooqbfuiwi..gdddfgiu.fyifsxavtmqqqvx.',
      '......aafgkku.Boqooooqmjkuu.gr.cefldrku.nyxxvvBBvtt.tx..',
      '....aalccuuu.woomooooqmikruurrrcce.w..u.hzaBtvvvvvvvx...',
      '..wsldccl.ii.joootoooqq.ugrrurugcc..kkrg.zvvtvvvvvvy....',
      '..flcclii....oooommoooqiuuukurrkrrkkkrrr.nvvBBvvvva.....',
      '.glclgg....w.oqoommqmoojuuuuukrrrrrrrrrkwyaaaavBasw.....',
      '.gggg......v.oqqqqmtqoo...uuuukrrkkkrrk.syysaaaaaa......',
      '..........vmoooqqqtmooooj.uuuuukrggkrk.zayyaassa........',
      '.yzzhhhhpyvmqmqqqmtmmoooo.uuuuuugkrlf.ywzasy............',
      '...ppgrrgh.oomqqmttqtmqmt...uuuuu.w.mvayy...............',
      '..ncr.rrrkwtqoomvBmmtvmqmt.guuwuwgvmmvB.................',
      '.hgrrrwrrgwvqqomxoBmt.tmmt.sgg.wga.oqvy.................',
      '.huurruruww.qoqqxooBmttmmt.ahhpAylbmvap.................',
      'whuuuwrrrgiw.qo.x.ooBtmmmt.vaaaxcsxxxs..................',
      'whuuuurrgrg..qoB..xooottmtmBxxBoB.......................',
      '.h.uuuuurrkkfqox..n.ioooobbbbboix.......................',
      '.whuuuuukkkrfqoz.shw.ggggigllliissssa...................',
      '...w..uuuukkb.jzay...iukuu.rgr..wwwssaa.................',
      '...y..uuuukg...Asa...w.uu.ig.g......wasw................',
      '...atv..uggj..xyw...........a.........asw...............',
      '....B.vvii...yza............a...........sy..............',
      '..............y.........waaaasaas........sz.............',
      '.............zs.......waa..saaa...........sA............',
      '...........wzza...........aAAAasasa...a....sy...........',
      '..........as..a...a.....szz...Aazzzsaaas...ay...........',
      '.........zzsw.a..aa...wzs......zzzyyysaaaaazsyw.........',
      '........zsssaa.saa.azyza.........ayzzyyyyyyzay..........',
      '........Awssaaaaaaaaszw.........yzzzyyyzzyzsyz..........',
      '........ysssaaaaaaayyyw.........zzysyyzyzssszyw.........',
      '........zsssaaaaaaszsyw.........zzyssyyzzyszzyw.........',
      '........pwwsssaaasssszw.........zzzysssssazzzz..........',
      '.........u.hhsaaaaassy..........aAzysssaashwps..........',
      '.......pgkuuhwaaaaasy............yyzzAzAAh..p...........',
      '.......A.kkkuuhhswzs.............y.wAzzzp...y...........',
      '......AspigkkkuuAzz..............s..wnpn...pzAw.........',
      '.....nzaaahhppuuz................y........Azyyzw........',
      '....nczaaaaaayn.n................szw.....AzyxsAza.......',
      '....ndcAaasszAAcn................A......zzzAAA.ws.......',
      '.....AlccccccclA..............................sa........'
    ]
  },
  buu: {
    palette: {a: '#44344b', b: '#f8bed6', c: '#cd91b5', d: '#fdc1e9', e: '#e6a7d4', f: '#917391', g: '#221336', h: '#4e3b8b', i: '#413165', j: '#3c2038', k: '#bb6bae', l: '#b28e89', m: '#f3c5dd', n: '#efbecc', o: '#f8ed9c', p: '#8e7060', q: '#2b2251', r: '#261021', s: '#f9ebbe', t: '#f4eff4', u: '#754cc2', v: '#cad3d3', w: '#fcfefd', x: '#dadfe3', y: '#6d48a7', z: '#a7afb4', A: '#0f0417', B: '#c8b288'},
    grid: [
      '..................................jjjj.........................................',
      '.................................afkff.a.......................................',
      '................................a.kkeekz.......................................',
      '................................gfk.ebmml......................................',
      '................................gf.rfcetmf.....................................',
      '...............................ajfA.Arfmdmf....................................',
      '..............................aamkA...Anmmmcj..................................',
      '..............................ajkfA...Afembefa.................................',
      '...............................aAA...AArcbnnerrg...............................',
      '....................................Afkckcdbmttkii.............................',
      '...................................rfkkkkkcbnnmddki............................',
      '..................................Afkkkdddbbbbbbddk............................',
      '.................................rfkakdddbmbbbbbbbek...........................',
      '...............................ajfkkkkd.emnbbbbbbnbm...........................',
      '...............................aakkkkkdcnnnbbbbbbbbbf..........................',
      '................................fcekkcbmmnnmdbdbnnmdc..........................',
      '...............................fbbdckdnbbnnnnmbbnbnnm..........................',
      '.............................jfemcbbkbnbnnbmeeeedbbee..........................',
      '.............................jakfjdndbbbbbbcjjrkbdbkaf.........................',
      '.............................jifjjdmdbbbbbddbdkjkkkjfec.rr.....................',
      '........................AAAAA.ffjkkkdbbmbcffkddkrkjkeckkfr.....................',
      '.........................yhyqykkkkkpbmnmndddbbbddddddbddmfA....................',
      '......................A.yyuhykkkfffkbtwmbbbbbnmjdmdnmbbbbnA....................',
      '....................rrkdmdfuyykkkkkdmttmnbbbbbbkarrfbbbnmm.....................',
      '....................kemdmmefyykkkkkdnmmmnbbbbbbmmmndbbbbmmi.A..................',
      '...................kbbnbbbbefyukkkkdnmmnnnbbbbbbbmmnbmbbechyyr.................',
      '..................keddnnbbbdkkuukkkcdnnbbbnbbbbnmnbbnnnneyhuy.ja...............',
      '...............j.fcdbbnnbcebckkfhkkkcdbnnbbbbbbbbbnnbbbbehhhffia...............',
      '.............a.akccmmbbbekkekkklhykkkedbbbbbbbbbbbbnbbecuyyi.ffA...............',
      '.............jjkenbbbbbdkkkkkfffghykkkdebbbbbbbbbbbbdecuyyhgg.fAa..............',
      '............gcnbbbnnbbbdkkkkfl.jggghykkkedddbbbmbbmddcyhyhqqggfA...............',
      '...........ikdjenbbmbnbdkkkfc.gggjiggiyykkkkkdddmddkyyuyiggigggA...............',
      '..........akdmdmnbbnmddkkkecjrggjaaiiighyyyyuyyyhyyyhyyhqgaagggfra.............',
      '.........jkdrmbbbbddddkckrAAAggqaaaaaiiiqfckyyuyhuuuyhhhqiiigggg.jj............',
      '.........jddmmbdkkcekkkkrAArrgqaaaaaaaaaafckckuuhyuyhyyyuyiagggg.ja............',
      '.......arkdbnnbbckkkkkcrAAAggggaqiaaaaaiaalnkuuhykkkkuyuhyyqggggffia...........',
      '......ajkkdbbbbbekkkkkf.AAAgggqaaqaaaaaqaafnkuuykddbbckuuuyyggggfff.r..........',
      '......ajkkkbnbbnmeckkfff..lrjgrjaaaaaaaaiapmeuykecckffkkkcqiggrllcclpr.........',
      '......ajkkkbbmmbncccckfffffppff.aaaaaaaaaflceykedeeeeeeeclfffppleclpp..........',
      '......ajkkkcbbdcnBBBBBlfkkkcklllllffjaaaflccekcbbbbbbbbbbcnellccbcllpl.ajj.....',
      '......agfkkkedncnsooBBcfkkkkkkkcnssn.pppnccbbdbbbbbbbbbbbbbblcbbbcllBlBjarj....',
      '......aj.kkkkblsoooBooBlfllkkkcbnnmlmsssnnbdbbbbbbmmmmmmbbbbmbmnbcfpppBBBpra...',
      '........rkkkklsooBBooBBsosBBBlcbnbbdbnnnnmbbbbnbnntttwtmmbbbbbbbbcplBBBBBBBr...',
      '.......arfkkksooooooBoooooooBBnbddbbbbnbbbbbbbbbnttwwwttnbbnnbbbblpBBBBBBBBBr..',
      '.......aArkklsoBooBBoooooooooBBbbbbbbbmmbbbnbbbbnttwwwtdmbbnbbbblcBBBBBBBBBBBaj',
      '........AgfkmsBooooooooooooosBccbnnbbbbbbbbbbbbnnmtttttmbbbbbbmkplBBBppBBBBBBaa',
      '......aghhgfBlooooooooooooBBBllcddmbbbbbbbbbbbbbnbmnnnbmbbbbdkrA.lBBBppBBBBlBaa',
      '......aqyhiABBsBoooooooooBBBB.rjajjkkdmmmmmdbdnbnbbbbbbmdbbdkjrAflBBBpBBBBBBBaa',
      '......aqyhqgpBBpBBBooooooBBBl.jjaaaaa.aaaaa.fkmdnnnnnnnmnkkjagAfvlBBBpBBBBpBBaj',
      '.....ajhuhqgapBplBBBBoooBBBBvvfgqaaaaiiaaaaa.aajsssssssB.aiijgfvvvlpppBBBppBprj',
      '.....jiyyiqqgvnpBBBBBooBBBBvvxxzfzzjqaiaiaaaaarlsooooooolaqqg.vzzvzppppppplpjja',
      '....aqhuuqqqgtxzBBBBBBBBBvvvxwxxtttf.zgqaaaaaaAsoooooooosagg.fxzzvzlpppppp.ja..',
      '....giyuuqqqgwwtxvBBBBBBBvvxttttwwwwxx.....aaaAsooooooooBaa.zzvvzzvzf..a..rj...',
      '....ghyuuqqqgwtwwxvzBBBzvvxwwxtwwwwwwwwxvvfa..jsooooooooz.fvvxfvvzzvf.iArr.....',
      '....qhuuyqqqgwvtwwwtvxvvvvwwwwwwwwwwwwtwxtwtvvvvsssssssvlvvvvvfvvzzxvhhA.......',
      '...giyuyiqqqgxvwwwwwtwwwwwwwwwwwwwwwwwwwxtwtxwwtxvvvlzvvvxvvvvvvvvzzvihiA......',
      '...ghuuyqqqqqxfwwwwtxwwwwwwwwwwwwwwwwwwwxtwwwwwwwwwwzvwwwtvvvvvvvvzzvfhhA......',
      '...ghuuhqqqqqxfvwwwtvwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwxtwwwwwvvvvvvvzzvxihA......',
      '..Aiyuuhii.qgxvfztwtvwwwwwwvtwwwwwwwwwwwwwwwwwwwwwwwxtwwwwwvvvvvvvzzvxhhA......',
      '..AhuuuyqqqiqgxzzxvvzwwwwwwvtwwwwwwwwwwwwwwwwwwwwwwwxtwwtwwvvvvvxvzzvfhhA......',
      '.riyuuyhqqqiigxvzzvzzxwwwwwvtwwwwwwwwwxwwwwwwwwwwwvvvvvxwtvvvvvvvvzzzghhqr.....',
      '.AyuuuyqqqqqqigvfzvvzzwwwwwvtwwwwwwwwxwwwwwtvxvxxxvvvvxvvvvvvvvvvzzvzqhhiA.....',
      '.Ayuuuhqqqqiqiq.zzzvvfxwwwxzxwwwwwwwxvxxxxxxvvvvvvvvzvvvvvvvvvvvvzzz.ihhhA.....',
      'jquuuuhqqqqqqqqq.zzzvfxtxxvfvtwwtxxxvvvvvvvxvvvvvvvvfzvvvvvvvvvvzzf.gihhhA.....',
      'Ahuuuuhqqqqqiiqhg.ffvzzxvvvfvxtttvvzvvxvvvvvvvvvvvvzzzvvvvvvvvvvff.rgghhhA.....',
      'giuuuuhqqiiqiiiiqgrazzlzxvvfvvvvvxvzvvxvvvvvvxvvzzzfzzvvvvvvvvzzf.rrgAhhir.....',
      '.gyuuuhqqhiiqgggAa.arrxfxxvfvvvvvvfxvvvvvvvvvvffAAAArA.ffvvvvvfAAa...gh.A......',
      '..ghuuhiiiAAA.....aAAgggAxxxzzvvfffxvvxxzf.AAAAA......aAAAAAAAAAAAj.ag.........',
      '...AhyhAAg.......ra.giggggAgr.ffztxxfAAAAAj..............AAAggggr.ar.AA........',
      '....Aihg........r.araaaagggAAAAAAAAAA...................aAAAggggA.ar...........',
      '.....gAr........rpnzAjjjAApvja.........................ar..AArrAc..............',
      '.................lBBssssBBBpra.........................aA.BfAAvn...............',
      '.................ppBBBBBBpppra.........................ar..BBB.................',
      '..............r.lBBBBBppppppra..........................r......................',
      '..............AlBoooooBlpppjj...........................aj.....................',
      '.............jpooooooBoBlppAa............................A.....................',
      '............j.BooooooBoBBlpr.............................j.....................',
      '............ABooooooooooll.ra..................................................',
      '............ABBsosoosssBppA....................................................'
    ]
  },
  cell: {
    palette: {a: '#385333', b: '#2b402a', c: '#3d3b41', d: '#0b1909', e: '#639a5c', f: '#649d40', g: '#8abc5b', h: '#b6bdc1', i: '#392e4e', j: '#180e25', k: '#f0f2e9', l: '#193114', m: '#a2d76a', n: '#3e7138', o: '#b5bd8c', p: '#0f051c', q: '#7e8083', r: '#1b1d1f', s: '#080c15', t: '#24262b', u: '#0a0213', v: '#79a15f', w: '#201530', x: '#66815b', y: '#433755', z: '#271a3a', A: '#322b3b', B: '#030804'},
    grid: [
      '................................cc..................................',
      '...............................boxa.................................',
      '..............................c.mg..................................',
      '.............................caegmg.c...............c...............',
      '.............................b.efmmbc...........egmvc...............',
      '.............................beefmmnc.........xxvgggb...............',
      '............................r.eefmmvaA......bvxaaa.oc...............',
      '............................dveefmmm.c.....dqvabtBboc...............',
      '............................dvaefmmm.c....Bqvabwsbgob...............',
      '...........................B.effemfgnt...dqebasjp.g.r...............',
      '..........................ydeeeefmmmg.j.Bqqb.ssps.mor...............',
      '..........................cdeennfmmmm.Bdeebcuucjs.gxt...............',
      '..........................cdeen.efmmmflvvaasuysBd.mxt...............',
      '.........................ytaeeeeefmmmv.eabrsyjjs.vvb................',
      '.........................ir.eeeefgmggx..ctuitpppxmvr................',
      '.........................cl.e.xefmmff....zwzsups.gvt................',
      '.........................clex.nefmmgfx...iyjuuss.gvr................',
      '.........................cbx.n.eegmmmv...yyipppBfgvr................',
      '.........................Ale.neeefmmmgxiiiiyyjudfg.r................',
      '........................At.eeeeeefmmmmvciiiiiyj.gg.u................',
      '........................Al.eeen.eefgmmgAwwzzwiBgm.l.................',
      '........................tbefnenneffmff.twwzzzzjvm.t.................',
      '........................tbeeeeeeefmmgf.twwzzzzrgfat.................',
      '.......................r...nneefffmmmmvrwzzzzzdvm.t.................',
      '......................dqomgen.neffmfgmmxwwwwzwqgfat.................',
      '......................d.gmmmgmfnfgmmmgvxrzzzwromvat.................',
      '......................d..fgmmmgggmffgggf.rzzzrom.b..................',
      '......................d...vomgmmgmffgmmggxrzzrgfbb..................',
      '......................B...qvvvogfmgvgmggmo.rr.vf.bc.................',
      '......................s.vvoxdooxogmmmgfgmmmblvgmvat.................',
      '......................rc.ooxdooxxbxommmmffmofmmve.t.................',
      '.......................ravoxdkkoxcib..fffvfmnmfvbt..................',
      '........................c.okdkkoo.ys.hveeefenevlc...................',
      '........................ttxokkakk.qcsxkkBqvq.qd.....................',
      '.........................cd.xaook..hkhhkkkhqbB......................',
      '...........................BB.xxoA.kkkkkkkkhqs......................',
      '............................sh.xxAhkkkkkkkkkB.......................',
      '.......................jppjwsh..qA.kkkhkkkqA........................',
      '..................wtwwwjjjjjqhh.qq.hkkkhohAuztttc...................',
      '................Aijzwzpjjwz.qhhqqq.qokkkoouupjjjAAc.................',
      '...............cjjiiyyzpwwz.qqhh.....hkkh.ujjwwwwwzy................',
      '..............cpAy.iiAizzzzAqh.qhh..ohhhhijwwjpjwwwz.....c...qhkk...',
      '.............cjz..iiwwAywwziyiyzhhq.....q.wwzzjujAijj....AttqhkhkkA.',
      '............twzy..iiyzwAyiwwwzyyiiiiAzyqqjzyiizpwzwzAp..Bkhqhkkhhkw.',
      '............twiyiyyyyzwrAyziiyiyAiiyiyyAwyyiiiyyzppjts.Bkh.kkkkkkku.',
      '..............cizyiywzzzwzzzyqqq..qy..zyipy.qyiyzjssrqBskkq.hhkkkkkA',
      '.............qxtwwwwwjppuuwjzyqqqqqq...iipzi..yzjpst.qBBk.hkkkkkkhkA',
      '............dbvorwjzBxoov..rwwzwwwwwwzwzpppzwwjwwst..B..Bkkhkkkkkkkp',
      '............tl.moldxomf.n.vxrrrrwwwwwwwjwwzjwwjpst.xaB..Bkhkhkhkhkku',
      '............caffmggmfn...vmmoxxmmoov.czy..iiwqx....a.B..skhhhhkkhhku',
      '.............vgfffffg.b.eggfmffmmvf..czyq.Ayr.vnaaab..s.uhhhhhhhhkhu',
      '.............vfvvvvgmed.evffmggmgnffv.cAy.yzb..nnnn.xxs.A.hhhhhhhk.A',
      '............xvffmmmgmvBb.xefggggffgmmg.cA.tbxxn...xeneaabaq.hhhhhhB.',
      '..........rvgfgmmgmfm.rub..eeffenvmmmge.Acb.x...nxeennvdlx.xhhhkhqB.',
      '..........rvgfmmmffmmdsjsst.xenefmmmveex.Aqeaa....eenvenvfexxohhqdB.',
      '..........tvvgmmgffmfBsppups..eenffeex.twts.Bc.....eeeafmmfe...fxhB.',
      '..........A.fgmmmmovBsppppppsB.veeexbtiyyiijus......eafmmmfeeevmmvB.',
      '..........sa.evmmmeBsppppuuBBBB..sji.q.q.qi.sBB..eennemmmfnnefexBB..',
      '.........pB.nnfffe.BspppuppboooBddrrttbc.Abb.q.dbxvenemmfennegvd....',
      '.........sxeeefnnv.Bspppjwrdfmmoavvemomoovovb.elssb..effeneem.l.....',
      '........uB.mmgeen.duppppjjud.fmmmnegmmmmmfmoleetpjrBdeeffffm........',
      '........Bxmmmmgen.Bppppjjt..d.fmmgnegmgeaaeode.rpjwus.efmfmb........',
      '.......tBommgfggnxBpuuwpA...d.nvmmg.a.....aa.earpjwjpd.mvlbb........',
      '.......uBommgffmnvBujjpA....BxvfgmmfaAi...cbxxlsujwwpcl.ab..........',
      '......cpBomggggggvBujwA.....dvmffggmfby...Axenbspjjwp.tAA...........',
      '......uzBomggmggmedpwt.....clmgmfngmmf...caeex.rsppzu...............',
      '......uzBogmmmmmoxBpp......rvmfmmgnvmmvAcaeeneebsppwj...............',
      '......uzsov....evBsp......Alffmgmmfngoo..xvnene.tupwj...............',
      '......pwu..ohhqx.Bu......cd.fmffmmmv.x.BBa.eeeentpjwwu..............',
      '.....uAwuhkkkkkkhB.......cd.mmffmmmfbddaqbvnneeebsjzwu..............',
      '.....uzpukkkkkkkkB......Acxnmfmmmfgvbt.bebenneeebspjwu..............',
      '....uzpjhkkkkkkkkkB.......evmmmmmfmbdt..eneeenfebspjwu..............',
      '....pwuwhkkkkkkkkkku...t.ggfmmmfmfelst.nenenefe.bsppwu..............',
      '...jwwpphkkkkkkkkkku...rxmmmmffmmndc.ct.veneeee.tuppzp..............',
      '..yuwwpuhhhkkkkkhkhB...r.gmmmffmf.B..Ar.eeenee.brsupzwz.............',
      '...pzwuphhhkkkkkqk.A...t.effgngmflc...Alenexne.lspupzzu.............',
      '..Ajzwuu.hhhkkkkqhu...cwc.nngfgm.b.....dxneenx.rsspuwzu.............',
      '.ypzzjppp.hqhkkkq.j...pjwb.vmm.........Aaeeenexrsppppzp.............',
      '.ijwwpuupp.A.hkhhB....jwA.xmmg.B........dxvaex.rppuppzp.............',
      'Apjzwppppuuj.hhhB....uwzAcbvhdds........sBqdq.tpppuppzp.............',
      'Ajwzwppppu..ABsu.....uzyizijuAu.......yujprBsBjjpppppzp.............',
      'Ajwwppujpp..........uAziyizyzpu......cjwpjppzwwupppppwp.............',
      'Ajwwpppwu..........pyizyyyijjwu......ijwjzpuppp.tuuuuzu.............',
      'AjwwppAu...........uyzziiiwpwzu......ijzwzzpzzj..Appzu..............',
      'Ajzzjzp............uyzwiiiwpzwu......ipziizpwzp...cjj...............',
      '.cpzwp.............uzzwizzjjwp.......Awwiiywwwp.....................',
      '..Aupy.............uzzzzzwwupy.......cuwyyyjzwpw....................',
      '...Ac..............uzzzwwwjup.........ApzyAjzzpjc...................',
      '..................Apzzzzwpppz..........ujzzuwzjjc...................',
      '..................ujwwwwjppj..........ywpjjpzzwpc...................',
      '.................yuzpzzwpjpj............puupzzzjc...................',
      '.................pwyyyizjpjjy...........ppppzzzjjz..................',
      '................pwBsBBuuwzjpp...........pppzzzzzjwj.................',
      '................uBxoooh.ruwwp...........juujpwzw.x.u................',
      '................Bokkkkoox.hjp...........uBBhhuu.ooooB...............',
      '...............tkkkkkkkooo.r.............dxohqqooooohB..............',
      '...............rokkkkkkkoqr..............uqxqqqxooooqu..............'
    ]
  },
  a16: {
    palette: {a: '#8d2f18', b: '#c0593b', c: '#473c2b', d: '#e7845d', e: '#965d4c', f: '#cee470', g: '#909b57', h: '#f3debe', i: '#1d0e0a', j: '#a19e80', k: '#ab6d5d', l: '#1a0e25', m: '#2d1f13', n: '#362a29', o: '#899e3f', p: '#0b0502', q: '#afc35d', r: '#747a42', s: '#3a2f4a', t: '#2d213d', u: '#423651', v: '#251738', w: '#c4896e', x: '#22162f', y: '#10051d', z: '#0e0411', A: '#616620', B: '#dfb88d'},
    grid: [
      '.................................u............................',
      '.................................Bc.....c.....................',
      '..............................ueBBn....cjc....................',
      '............................mnkwbdwn...mB.....................',
      '...........................mcnedbddBi.iBBd....................',
      '..........................i.amabbddawiBBdd....................',
      '.........................maadabbbbabbdBddk.u..................',
      '.........................iadbaabbbabbdddbacnu.................',
      '........................ucdbbaaaaaabbbbbaaa.eu................',
      '.......................ucadbaaaaaaabbbbaaabkku................',
      '.....................ce.nadbabbaaaabbbbaabddks.c.s............',
      '.....................uaeaabbabbaaaaaadbbbbdden.ckm............',
      '....................uxaakambaabbbaaadBBBabbbammkki............',
      '...................ulmmaamkbaaabbbadBBBddabaababam............',
      '..................ss..aamewabaaabadBBBdbddbdddba.z............',
      '...................un.a.kwkwbbaaaadBBdbdddbddBdki.............',
      '....................ui.iwhhhwkkkkbdBdbdbbbaabdBBi.............',
      '......................ikhhhhhwwwwbdddbbaabaabbdwi.............',
      '......................ijhhhhhhBwwddddbakk.aaabbBi.............',
      '......................mhwwwhhhBwwwbddbbkek.aaabwi.............',
      '....................uiiBwwwBwwwwwwkbddbawkkeaabki.............',
      '...................cc..kwwwwwwwkwwwbdddbdwweabbei.............',
      '..................u.AgogkBwwwwkekbddbddkwwwbabecn.............',
      '..................c.qqogwBBwwwkeabdddbdwwwwkae.z..............',
      '.....qffffffgcm..nrqffogheahwwwkeabwwdbbwwke..imi.............',
      '...cBgooofffffgii.qffffgheewhwwe...c.abkk.eecmgogp............',
      '..nBgooqfffffffooAqfffgAwhewewwke.hhhi.k.eaeggoffgp...........',
      '..nBoooqfffffffffqqfffAAewhwwhhhBechhnkkk..mmoffffgp..........',
      '..nBoooqffffffffffoofqAkkcewehhBwwhhjewwwemcgoffffgp..........',
      '..nfoooooffffffffffqofheeBawweBhhhhhhhhhwmcrooofffgp..........',
      '..cfoooooofffffffffqoffrwwe.wwkwhhhhhhhhh..roooooogp..........',
      '..mhoooor.mmoffffffffffBwww.kwwwwhhhhhhrggAAAooooogp..........',
      '..phooor.mxiccgffffqqfffwkw.ewwwBhhhwwwAggorAAoooogp..........',
      '..pjqooAnxvvli.gfffqoqffBkee.ekwBhhhBBkrgoorAArooogp..........',
      '..n.qoo.vvvxxlx.fffqoofffqee..kkwhhhhhrrgoorrAAroorp..........',
      '...pqqgrtvlyvvxmBffqrAqfffwAe..ekhhhhhArogoorAAAggcp..........',
      '...irBjruultvvxxrfqqAAoffffoA...ewhhhgc.rooorcAAggiz..........',
      '....irgrustsuvvxmroogAAoffffgk.....kcc.c.ooorAAAg.ly..........',
      '.....m..usxuuuvvl.rgrAAAofffqqwkkk..kecccgoooAAr.lly..........',
      '......nztuvsuuvvtxcrgAAAAoffffwwwwwkawwecooorAg.pxyy..........',
      '.....xvusvstuuvvvxn.AAAAAAAooqgBhhhweewhjgorAogpyyyzz.........',
      '....ytususyytvvxxncroAAgoooooofqBhhhhwhjjgAroogpvtxvtyu.......',
      '...zlusuuuvyyxvy..ArgAoofffffffqogmcsncniAoqffgmvvusvvls......',
      '...zvsuuuutssuvz.ArgoAgoffffffffffgnssum.gqfffgxvsuustxs......',
      '...yxsuusvsuuusi.rgrAAoooffffffffffBlsx.gqffff.lxsussvxxs.....',
      '..tlluustssusttlrgrAAAAoooffffffffffr.crqfffqgcvvssuuvylt.....',
      '.sxlltstxtstvvvx....AAArooqffffffffqgAAgqffqgrxvvsuuuvlyt.....',
      'uyxllxttlvsvvxtllmc...AAoooffqqqqqqrr..rrqqg.clvvxtusvylvu....',
      'zxlttllylvsvvvlx..cn....Aogooooooonxtxttl.r.iyyxvvvsvxylll....',
      'zx.sstlylxvxxxy....nii...Aggoooogggicsusmrrcx.yyvvvvvyxlxx....',
      'ysssssvtvxyyyz............AAAAAAAAgfgiimBA.cx..yllyxlvvvvxz...',
      'zusssstxyyxyz...........p.ggggggggoofhhhoocn...yyxtlyxvvvxz...',
      'pinnnnmpppmlp...........pjAAAoorAAAAAoooAorcm...pplippiiiipp..',
      'pjhfffhfggj..p..........p.goooooggAgoooogAr.ci...c..gjgjgjj.p.',
      'ihfffffqogg..p.........p.ggoooor.imroooggcm..i...c.rgooooggjp.',
      'ijoofooooAAArp.........pjAAoorA.itxmgooggmm..i...cccAAorAAri..',
      '.moffqfqooA.mp........nrgoooorrcstsiroogrmx.r.l.ipc.Aroooorp..',
      '.igffffqoo..pu........ifqrqooo.cssutuc.cnxxcrrz.up...ooogo..x.',
      '.n.qffqqor..p........cAfqofoog.ssuuusttsvtxc.gz..nm..rooorc.p.',
      '.ccqffqqoAr.mc......c.qfooffor.sususssuuvvtn.rp..smc.AoooAA.mc',
      '.pjffffffog.rp.....ucqffofffgmtusuutususvvvxcgmu.z.c.Aroggogrp',
      '.phhfffqggj..p.....u.ffofffog.uusuulsuuxxvvvcg.z.icc...rjgggjp',
      '..plllllllxlp.....n.gfffffgjmtuussuvyxxvyxvxn.gp..zzyzzzzzpzp.',
      '..yxxtvtuuunz.....nrfffffgpn.uuussuvyyyyvvvxn.gi...zzzylxvtxz.',
      '.zxvvvsussnjjp....n.ffffgpssuttuuuuvyyyyxvvxxn.pi.kkipzxxvvxz.',
      '.zvvvvst.jhhhh....nrfffgpusuuvtuuusyyyyylvvxvv.i.kkek.nixxxly.',
      '.zxxxl.hhhhhhhhi.uncjfgisusuuttuuuvyyyyxvvvxlxziekekkeekkuxxz.',
      '.pjwhhhhhhhhhwhhn.timinsuusutvsuusxyyylxxvvllxypkek.ekkkekk.p.',
      '.pkwwhhhhhhhhwhhn.tlxxvsuusuttsuuulzyyxvvvvllxyi.k..kkwwwkkkp.',
      '.ccwwBhhhBhhhehBm.txvvtutssuvsuusvlylyxxvvvllxzz.e..kkkwwee.z.',
      '..iwwwBBBwhhheB.cutllvxssuutvusvtxzytyvxvtvxylssn..ekewwkeenn.',
      '..m.wwwwwwhhheem..uvvltluusvvsvtxvlyvlvxxxxlzl..nceekkwww.cl..',
      '.....kkeewhhhkm....slvvtsulxvvvls.vzxlxvvxlyyl...pkkewwkkci...',
      '....miipcjjhji.....syvtuxuxtxvxs...zvvyvvyzlll...p.eekwk.m....',
      '........szppz.....tylxussuvvyls.....zxyxllxxll....zipzppn.....',
      '.................llvxtuuuutvyu.......yylyylllxz...............',
      '................zxvxtxtuutvxy.......zyyxvlyylxz...............',
      '...............zxxlvyvvvvvvvyu.....zyyxtvlyylxy...............',
      '...............yvlvllxvvvvsz.......zyvvvvlyyyxy...............',
      '...............zxxxllxvvvtty.......yyxvxvyyylxy...............',
      '..............ijmlvxlvvvvyxy.......zzyvvlyylyzy...............',
      '..............iBrmlylvvxlxyu......tzzyllzzyzxuy...............',
      '..............pBqr.clvxxlxz......nsppzzzc....ry...............',
      '..............iBffqg.....cz.....ui.mcmncrgoogrz...............',
      '..............ihffffffqqqgp......i..ggggooooorp...............',
      '..............pBffffqoooogp.....ui...AAogooorcz...............',
      '..............ihffffqooggrp..........AAgoooori................',
      '..............igffffqoogrp..........rAAoooogrm................',
      '..............zjoqffqogrp............AAoooorci................',
      '..............p.goooog.p.............AAogorcn.................',
      '..............pjAroAA.p...............AAAA.cm.................',
      '.............pgoffffqgz...............gogAr.cpp...............',
      '............irffffffffgi...........i.gggArgrrg.ly.............',
      '............pBf......ABri..........igooAoorrr.mmlx............',
      '...........n.rrmtuustnrjp..........pgooooor.cclxxlt...........',
      '...........zjns.ussuusn.p..........pggoorr.nlvvvvvlu..........',
      '...........zu..........tz..........prjgggcsuuuuuuuuz..........',
      '...........pjhhhhhhhhhhjz..........zjjjjhhhhhhhhhhjz..........'
    ]
  },
  chaozu: {
    palette: {a: '#471525', b: '#8f4552', c: '#354664', d: '#2f374e', e: '#1d2742', f: '#070312', g: '#dde0e6', h: '#f9fbf5', i: '#cad0d7', j: '#211c2b', k: '#fefefe', l: '#080b26', m: '#add3f5', n: '#f4fbfc', o: '#eaf0f5', p: '#4e3849', q: '#3b323e', r: '#f9fefe', s: '#180b1c', t: '#fdebec', u: '#fdf8fc', v: '#a3a7b7', w: '#342240', x: '#563561', y: '#665c89', z: '#6e89c3', A: '#4f71a5', B: '#808493'},
    grid: [
      '............aa................................',
      '...........abba...............................',
      '..........pabbapqpppp.........................',
      '..........abbbbajjqwww..p.....................',
      '.........papbb..cc.ddwwwj.....................',
      '...........s....c..c..ccdj....................',
      '...........f.cBBc.ccc.c.cef...................',
      '............cBABc..c.....cjj..................',
      '............cBBcc...deeeeeej..................',
      '........qj.eeccc.eeed......dj.................',
      '........pj.ded.eed...cccc...l.................',
      '........qjceee.....dygooooiel.................',
      '........qj.eed.edviigonnrrnvs.................',
      '........qsdceddvBgrnnrgrnkngf.................',
      '........pwjddBBginnrhggokhgBj.................',
      '.........pj..ggigkkhkgogkhvj..................',
      '.........p.giiigkkrkhhirkof...................',
      '........q.oBdnirkurkovjrigf...................',
      '........q.oBBgirhkkgovjrioff..................',
      '........qpgrBgirkttggvjnikt.f.................',
      '.........psgrgBihbbvgkrokotus.................',
      '...........ffBBghbbvgirrhohrs...qfssff........',
      '.............ffBntthkkuuunngf....vggiossss....',
      '............ssfegohhrogBnrojlll.viigBvgoiBqp..',
      '...........abbp...ionnoggdycczBvigivBgrrniB.q.',
      '............yB.pde.BBBBB..ccAzzviviBgrnrnoiiBq',
      '...........BvBB..ccdd.....ccAAAvvviiorvgrnrgBq',
      '..........mmmvBb..pppppp...dcyczvvirni.vgivv.q',
      '.....ppBigmzmmBbb.bbb...bb..lccyBBBgiBjjBBjjq.',
      '....jiiorommzzBbx.b...p.tt.pflll.BBBff..ss....',
      '...fgirnrroAzv.......bbknqtbasp.qfff..........',
      '..sfiBBBirroz.s.ccc..Bgdj.gpws................',
      '.fkgkrrvBvknfsdec.c...qqofu.ws................',
      'suinkrkriBBgfeeeeeee.yisgo.jws................',
      'sgkkkrrkivifedededddep.gtxwews................',
      'fukuiqvgvfsldeeeeeeeeww..www.s................',
      '.qjwjqjqq..s.wwxwweeeeeqqww.jp................',
      '.pppp.pq...qwxxB.dwweewwwxx.sp................',
      '............sByzyxxxppppp.yyf.................',
      '...........edvzzAyyyyyxxyyzzl.................',
      '...........fAmmmzzzzzzyAzzzzl.................',
      '...........fzmmmmmmmvzzzzzzclp................',
      '...........fgAmmmmmmzAAzzzzl..................',
      '...........lgmAmAAAAAzzzzcyf..................',
      '...........flommmmvclezzzzf...................',
      '.........pfeelgmmBlleeeeel....................',
      '.........pleeellffffeeedf.....................',
      '.........pfddedf...jldes......................',
      '..........pleef.....qfs.......................',
      '...........qss........p.......................',
      '............wq................................'
    ]
  },
  tenshinhan: {
    palette: {a: '#300d17', b: '#b88f71', c: '#bda492', d: '#100208', e: '#fbe3b8', f: '#fbe6c7', g: '#e4c8a6', h: '#292b43', i: '#d4cfca', j: '#97464c', k: '#8f7d7d', l: '#a36e5a', m: '#394b5f', n: '#1c1f32', o: '#483644', p: '#fef9ec', q: '#723846', r: '#4c0f2a', s: '#faebd9', t: '#e7e5ec', u: '#5f1628', v: '#421037', w: '#886148', x: '#faf9fa', y: '#541d37', z: '#3f212c', A: '#1c0617', B: '#31112f'},
    grid: [
      '..............................aaaAAaao.................................',
      '..................AAad.....oaacbsspcbyao...............................',
      '.................zssfca.....cseeeeeeefg.y..............................',
      '.................gfeeffa...cefppeeeeeffgka.............................',
      '................cclbefcAz.cefpxpfeeeeeeegla............................',
      '...............bclwwl.ooacgffppseeeeeeeeeg.z...........................',
      '............o.lbcbbbwdAzogeefpseeeeeefeeeegA...........................',
      '............qbbcgeeeco.dcgeeeeeeeeeeeeeeeeezo..........................',
      '...........zbccbbeggfsidgeeeeeeeeeeeeeeeefecA..........................',
      '.......AAAdlbbbbbblbfskAbgeeeeeeeeeeeeeeeffsA..........................',
      '......dxxpwbbbgeeeebddddbgeeeeeeeeeeffefefefd..........................',
      '....onxxpybbbgeeeeeesd.dkbgeeeeeeeeeppffsffsd..........................',
      '....odxxylbbbbbbbeelcd.Abbbceefeeeffpppc.sfcd..........................',
      '...ootxpwlbbbbgeeeefd..AlbbbbbfffsbfbippibsAd..........................',
      '...ohixpwllbbbbcgefcdAddlgegblbzzzzbefsffiaod..........................',
      '....cixpwlllllbbbwaa.ohAibwbgblaooo.bgeegkond..........................',
      '.B.cgcipwqlllbccwwq....niblbbbbkBoooobccbohAo..........................',
      '.akeecip.....kccwwj..mmnccblbbbgcccho.ll.z.d...........................',
      '.zkecbgtk....cicwjj..mmh.cccbbgfittkh.ll.zcAhooh.......................',
      '.Awgblksi.kkcicbwjj.mmmmh.ccbbeegipinkblwziAnnhBo..........o....ooo....',
      'oz.cbbwiitiiiikwwjj.mmmmhh.bllgebbppocegbk.nmm.yvo.........zfsfbozo....',
      '..zocbbwiiiiikwlbjjmmmmmhho.jlbefeeffgeeikhmm..jjao.......dpfefegbffz..',
      '...oawcbb.wwwwwlbwqnmmmmmho.lllbeeeeeeec.hmmm.qjcao...ddddpffeeeeeblpd.',
      '.....ddkccccwwwlbj.hhmh..hoqjjllwbeeblqoh.mmm.jjec.zonxxisffbbgfffelfsa',
      '.......dddd.ckbcbjqhhhn....qujjjllbfsg.ohmmm..jbef.doxxskfebllllwwwwfsA',
      '...........ddddobwqhhhhoqjjq...qjjq.hohhmmmm.jjefcgigptzbbbwqqq..llllsd',
      '...............zoc.zhhn.jqq....qq....hmmmmmnBjjfbgffsppsfblllqzAdaqllqd',
      '.................a..zoA......ljj.o..mmmmhmhhzqlcbgfesppfeewl.koB.Aklq.d',
      '.................oaa.Bnoho.jjqqqjw...mmmhhhhqjwcbgggspscfeq..koh..a....',
      '...................oBznnnh.jjj..qjjq..mhnhhhqbwblccgpps.bfu..c.h..oaa..',
      '....................hnnnhh.jqjjjjqjj..mnnhhhqbwbwbbgstxcwbq.ki.h...zz..',
      '.....................nAAhhoqoqjjqqqj.ohnnhhvqjwlwbbcittxk..kii.n.......',
      '......................dzoBooozqzhv...hhnnnhhjjwqwbbbcttxx..xti.h.......',
      '......................Ayyyzoq.y.zv.vnhhhnnhB.rza.bwbcixttxpiicoo.......',
      '.......................AB.yBovqq..nhhhhhhhno.zA.dklllkixiiiikno........',
      '....................dddkk.yqq.BvyBhhhhhBzBdAAd...aowkcbww...Ao.........',
      '..................ddxxckkciikq..qyzBnBooyyA.......zdddlw..kA...........',
      '.................AttkAyvBkitxxikqqq.o.q..yBd..........ddddd............',
      '.............oaAzkazyuryyra.ixxtttsffcckkazBA..........................',
      '...........aBBvyryruuurrrrry.ikBryz.bcbcbckaBAd........................',
      '..........arrruuuuuuuurryyyr.iikrrwbcgeefffglazzAo.....................',
      '.........zrruuuuuuuuuuuruuuu.tiiuqbbeeeefeecblkaBzao...................',
      '........orruuuuuuuuuuuuuuuuu.xisulbgeeeeeeegggg.uazzzo.................',
      '........ayruuuuuuuuuuuuuuuuu.xixwwbeeggeeefefffcquryaa.................',
      '........Byrrruuuuuyuruuuuuuu.xipwwbgeccgeeeeseefcqrryza................',
      '.......Ayyvvvryyrrrruuuuuury.xxpwwwwbgeeefebeefeelyrurza...............',
      '.......Ayrvvvvyyrrryuuuuurry.ixx.wbbbbbbceffbbffclwllazyA..............',
      '......Ayyvvvryyyrryyuyyrruyyoixxa.wccbbcbbbbwbbbwwbbcbayzA.............',
      '......AyrvvvyyrrrrrrrrrryyvBoixxAzaa..lwwwcbbwwwwwbblblwaA.............',
      '....oAyrrvvvvvvvvvvvvvvryvBB.txxavvvraay.wwbcbccclwwwbwwwzA............',
      '.....ayrrvvvvvvvvvvvvvvvyvBBhkxxAvvvvvvvaawwwwwwwwwlbbww.aA............',
      '...oAyyrvvvvvvvvvvvvvvvvyvBBhkxxABBBvvvvvzwwwwwwwwlblwww.zBA...........',
      '...oAyrrvvvvvvvvvvvvvvvryvBBBoxtaBBBBvvvvvzwwwwwwwwwwwwwkABA...........',
      '...oAyrvvvvvvvvvvvvvvvvvyvBvvB..BvvvBvBvvvz.wwwwwwwwwwwwzBBA...........',
      '....zarvvvvvvvvvvvvvvvvvvBvBvvBvvvvvvvBvvvvqqwwwwwwwwww.yBBh...........',
      '....oAayvvvvvvvvvvvvvvvyaBBBBBBBvvvvvvvvvvvvr.qwwwww...qqyno...........',
      '....oAooyyvvvvvvvvvvvvvyAaBBBBBBBBBBBBBBvBBvvBa.....zzy.o.hn...........',
      '...onh....yyvvBBBvvvvvvyAo......AdAAAAAAazBBBBzaBBBzBz.z..m.dm.........',
      '..znhmmm..hohzBAAvBBBvvzAo..............odAAAAAAdAAAooom.mmm.A.........',
      '..hnmmmmmmonnk.noAdAABzzAo........................Boknnmmmmmndo........',
      '..hocttttttccnh......AAddo.........................oncktttttcno........',
      '............o..........................................o...............'
    ]
  },
  yamcha_z: {
    palette: {a: '#274499', b: '#0e041c', c: '#22152e', d: '#150a24', e: '#180103', f: '#150515', g: '#0b0113', h: '#31233e', i: '#ad9da4', j: '#a96e5d', k: '#fbe0bd', l: '#be8b75', m: '#e3bea3', n: '#905e5a', o: '#647cd0', p: '#4c191b', q: '#4b3545', r: '#efe7e4', s: '#383972', t: '#f07631', u: '#f57a1a', v: '#e07846', w: '#7a3636', x: '#ca4c19', y: '#b7412e', z: '#c55138', A: '#9d2a20', B: '#2b070a'},
    grid: [
      '......................hcq....................................',
      '.....................cccq....................................',
      '.....................cc.hdggg.......qhccc....................',
      '...................dgbdbbbdbggg....hhchhcd...................',
      '..................cc.gdcccddbdffg.hhccbbdgd..................',
      '....................gqqhcccbbbgdgcchcbcggbdc.................',
      '...................gcqqhcccbbbbbdchddddbgg...................',
      '..................fchhhdccdbbgddccdcdbdq.....................',
      '.................hdchhdccdbbbbbcdcdcchhqhh...................',
      '.................fdchdddddddbbbddbdchhhhcdq..................',
      '................qgcdcbddbcccbbbbbdgddcccccc..................',
      '................gdccdbbbccdbbbdbdbdbbbbbbbcd.................',
      '................fgbccdbdbbbbdbbbcccccbggbbbdc................',
      '................gbbbbbbbbbdhhcbbgccchcggggbffeq..............',
      '................gdbbbbbbbbddcqcddbbbdccd........qhhs.........',
      '.................gbbbbbdccgbbgccbgbbbdccg......h.irrs........',
      '................ggbbbbbbdccd.gfbbbbggddcf.....hnmkkrccsq.....',
      '............hfdhcbbffbbbbdccf.dfbgq.qfbgg.....hnljnnpirrs....',
      '...........hccccbbf.ffbdgc.....efgqw.qddb.....hnjnjwlkkrs....',
      '..........cccccdbgfnwebdhqphpp.qqBn..qhqg.....hnllnwjlkic....',
      '.......qqhfdcddbbfelwqccq.qcqhqh.wn.qhq.q....q.jljjwnjl.iii..',
      '......ii.hcfgdbbbgflnpfc.n.nnhqhwnnqhhq......hnljjjnjjn.mki..',
      '..nilikklnqBgbbbbbd.n..q.llrr.hqwjw.qbfq......jljjjjjnnjjmk..',
      '.ikkjkkkkljqcfbbbbfepkkn.lirrrejllll.ccb...cmklllljjjwlnwjm..',
      'ikkklkkklmln.qbbbgeBlmkkj.mlrrplkmlnn.fff..crkklllljjjjwjwnqq',
      '.ikklkkkknjl.ebfgelknlkkl.klkkkkkkklnqeeeBeerkkkmllllnjjjllqq',
      'q.kkkwkki.shdegelkkkkncfhnlkkjkkkklnpepzvlnBlkkrmnjlllljejiqq',
      'qhlkkkw.oos.mrrkkkjkkBffpwwlkkljlnwpepzvvkklBwwwjlljlliB.eeq.',
      '..BlllliosimkkkkkjplkBgqwwjnwlkkklzppzvlkkkkljnllllwlie......',
      '...Blllsaikkkkkkkklwweeqnwwljjwwyyvvvvlkkkkkkljnjjj...g......',
      '....eeihhrkkkkkkkkkwjnjwnmjjlkkAztttvlkkkllnnlq.s.soossb.....',
      '......hhhimkkkmjlkkwnlmmjwllmklvxtutvllllllklnqsaaooosig.....',
      '......qfdqlmkkmljlmBpjlmjwjjmmzvxxtvjjnjljmkml.saaooaore.....',
      '.......hhh..lmmljlleBqwn.wjlljvxxxzvjnnjjlkkklj..oiiilre.....',
      '..........hBqlmlnl.pppppwnnlvztxtxyzwwnnnlmkkljllmkkklre.....',
      '...........cpnllw.BwAAyzzyAvztxtxzzAwwwwwnlkkljlmkkkkkre.....',
      '...........cqjilBBwwzzAzvxyvvxvxzAyzyAwwBenllljlmkkkkkke.....',
      '............hBee..BwzzzAyzxxzzAzyyAyywwe..eejllllmklkkie.....',
      '...................fpwnzyAzzzAzzAyjwpeh.....Beeeeplirie......',
      '...................bhhhpnjnwwwwwjjpBh.............eeee.......',
      '...................Bnwpq.sssooshhpwBp........................',
      '...............ccpBzyzwqsssoaooscwyywp.......................',
      '............qqqnyvvvtxzAnnnoassnlzvtvwh......................',
      '.........ss...vvttuuutttzznoasqvtxtuxynh.....................',
      '........qnjjvtuuuuuuuuuttvnoassvuuuuutzwqq...................',
      '.........vtuuuuuuuuuuxtxxynoaasluuuuuutzw....................',
      '......q.ztuuuuuuuuuuxxzyAAnoaoantuuuuuuutzpq.qqq.............',
      '......Bjtuuuuuuuuuuutttzyynoaoa.ltuuuuuuutzB.ppBp............',
      '......pytuuuuuuuuutxxzAAAAwoaoss.vtuuuuuuuxzBwzApBp..........',
      '.....elxttuuxxuuutxzzzzzzn.oaoaasnxuuuuuuuxzAyyzywne.........',
      '.....evxxtuxxxtttxzyzywwpehoaooasltxuuuuuutxyzzyyAwB.........',
      '.....elxxxxxzzxxxxyAApBeq.hooooaanvtuuuuuuutxyzyyAzwe........',
      '.....ejvxxzzzxxxxvAAAwBq.qcooaosacwztuuxuuutxAyyyAywe........',
      '......pvvzxxxxxttxyzAwpq..hooaossceBAvttxttxyAyyyAywe........',
      '.....fjAAxvvttttAxzzAwpq.qhooaodbdq.ppxxxxxzAAyzyAAwe........',
      '.....ewzAAAAAAAyyyyAwpq...daoaab......pAzyzAAAzAAAw.gc.......',
      '.....qpzyAAAAAyyzzyAwBq...qdshcq......qpAAAAAyyAAAwh.ich.....',
      '......ByyyyAyyzyzyAApp.....qqqq........qpAAAAyAAAwwcirngq....',
      '......ppAzzzyyzzyywpq...................hpwwAAAAAwq.rrrdcq...',
      '.......BpjljjjjjjppB.....................Bwwwwwwww.rrrrhcb...',
      '.......fgjirrmiiig........................fBwwwqq.rrrrrrdd...',
      '......dgchc.iricgb..........................eefg..cqqdgicc...',
      '.....fchqqqqhccbgg.............................hcdbbbdcccd...',
      '.....fggggggggggf..............................cffgggggcbg...'
    ]
  },
  shenron: {
    palette: {a: '#342c15', b: '#047e1c', c: '#cc8d48', d: '#5d4318', e: '#812a0c', f: '#114e1f', g: '#0a8e24', h: '#277f36', i: '#285641', j: '#001101', k: '#0c0702', l: '#ecc882', m: '#1f9c37', n: '#347b5e', o: '#000901', p: '#126c20', q: '#05390e', r: '#020302', s: '#032509', t: '#001b02', u: '#020908', v: '#16aa33', w: '#9c6925', x: '#0da82c', y: '#2d5e1e', z: '#1f0e04', A: '#090101', B: '#a49b73'},
    grid: [
      '.................................................sr.....................................',
      '.............................................s.nsnu.rruu................................',
      '.......................Akr..................qfouiisuiiiu.uur............................',
      '.......................Acd.............kdBronfttttttjorrfnnr............................',
      '.......................rwwA...........rcwoqjtpgxxxxvxxpttjrus...........................',
      '.......................rwdr...........dwwksbgxgxvxxvxxvmxptnnu..........................',
      '.......................awdA........BsBwwwjmxxxmbgvvgvbgbxxmsjnr.........................',
      '........................AwA........siAwwdqvvbmbgvbbvxvbvbxxmfjr.........................',
      '.......................BAwA.......sirawdkvxvvbvgbvmbvbvvgvggvbho........................',
      '......................rAkwka.....jirAwwaqvxxvgvbbpyyyhphgxvggvpij.......................',
      '......................Awawzwu...smjwkwdrhmgvgvbyyeeeeeeeygvgxxmti.......................',
      '......................kwdwdwr..ohhkwwwdroopgbpyeeecccwccedpbxbxmt.......................',
      '.......................dwwwwa.onjhawwwkAwdopyeeccwccwccccedpbvxgpr......................',
      '........................AwwA.rnonjddwdwwdrsyeeccwccwccccwccdhxvgmo......................',
      '....rrrr................Awdr.jnsipowwwdstfdecwiiiiiiBBwwcccedgxvbhr.....................',
      '..BacBBBrB..............Awwrththjqdwwdspfdecwn......rAwcccwcedgvghr.......BBalllBBB.....',
      '.BalBuualBd.............AwdrbmsiiowwaqppyeBkB.........awwwccceybvgj.......allzzki.A.....',
      'BdBa....rdBB............rttjpmpjfzwdoppydwAr...........Acccccedpbgpj.....alrr....aBd....',
      'aB........aBk..........BqmmpjmfjtptropfeeaB............awwwwwcehbgpj....Ala.......kda...',
      'lB.........ia..........jxxxbshtqxxgfopfezi..............Accccceyggpj...rlA.........aBu..',
      '...........nlr.....rof.jgxxbfsbxxxgpofjofhju............Accccccepbpj..Alr...........rB..',
      '...........nBr......spjogxxbpbgxxxgfrqmghfiqr...........Awcccwwepbpo..kBr...........kBi.',
      '...........BBr.....qpfhtvxxxgxxxxbgfqgbpttjj............rcwwwccepbpo..aa.............rr.',
      '...........BBr.....Byfhpxxxbxxxbpbpbgbqfhhhfu...........rccccccepbpr..aa.............rA.',
      '...........Bli....ujqfqxxxvbxbbvvgtpppghstjo............rccccccepbpo.rBu.............rA.',
      '...........Br.....fhhqqgxxggbxvmppfpfppqbgghou..........Awcccccepbpo.rB..............rr.',
      '..........rli......sqqkzgxvbxvhzzobbfspbgmhtni..........Alwwwwwepbpo.rB..............rr.',
      '.........BBk........thzeahpvmyzeejxxgpjpftf.r...........Allllllepbpo.rB.................',
      '.........ABa.......ryfhzekffizeekpxxgpjqbbhj...........Aclllllcepbpo.rB.................',
      '........wBi.........jtghkqfjrzkjmxxpfpfphhtou..........rwcllllcapbpo.rB.................',
      '.......Alr...........jhgbggbmfbbxxpsBftqsio...roo......Alccccceyppo..rB.................',
      '......rlz.............jgxxggbgxxxgjccwspyu.....mmo....Allllwwwepppr..rB.................',
      '......Ala.............nqxbxgxggxmqcccwroo.....oqno....Allllllleppfr..AB.................',
      '.....Alr...............sxxgxxxxbpolccA.......ohhoqj..rzclllllldppo...Bk.................',
      '.....rcB.............BoxggxxxxmfAwcwB......BtqqhqBfllBllwwllceppfr..rlA.................',
      '.....rB.............BrfxxgxxxgprBdai.......rnfpppyj.wllllcccceppj...Alr.................',
      '.....uB.........BAzkjpxxggxxmstllBlBBBad...a.jfspo..wllllllleypia...llr.................',
      '.....kl........BwllBsmxxxhqvgllzwBArrrBlBr....rppj.rwclllllceppr...BlA..................',
      '.....dlA......ndBrkrtppxmsbgpszlar.....rAlBr...jppoAlwclllleypfr...klA..................',
      '......kl......BBB...fhxxxvxxfrwlr........ralla.uhyklllccllcdppr...rlr...................',
      '......kBw....aBa.....jgghgpfkclr...........rwlA.kkllllllccdypfnjiawljuuu................',
      '.......dBkrrrli.......sjzoailwBA.............klBzBwlllllleybpjunrAlonnnnjorr............',
      '........alllBa........r.ele.ecA...............AclABcllllcdpbpjkrllrrjjjjnqnurr..........',
      '.........kkAA.........a.eelzlBr...............kkalzkaacceayforllrropppghtjsnsnro........',
      '....................rr.Acccccr...............AcllAdlllllllllllojppyfppppppfjnstho.......',
      '.................uusnsroooouo...............AccllllAAAAoororrofppjjpppfpppfptnntho......',
      '...............rsnsnnnisnnnnnju..u.........kcllccllllcdpmmmhopppthhjpbppppbbpjnnghj.....',
      '.............orqiinftjoojjjsfnnuunu.......Allllllcclceyppxvpjfffjllopppppbbbfptnqhho....',
      '...........jshsioqfgvvvmxmvmqttjniiruuu..Accllllllwceypptmvghjqjhlrjyyffpbpbpphsntgmr...',
      '..........shmtitgxxxvvxgvbxxvvvmtojnninuAllcwllllcceypftptmmqhhghjspqjddfpppbpgqntgvt...',
      '........otmmtnqvxxxvbgvgvvgbvvgvvmhjojnAlllllwlllceypfofpthhrlpgpbgbmpAwddpbbghqnjpvmo..',
      '.......omhtnnsvxxgmbvvgvbbmxbbvxvgmmhhklllllllwcceyppjfppyjjjojppbbtnlrrrAyppbppjntvmo..',
      '......jmmjnjsvxgxbbmbbvbvvpbvmbvbvvbmkcwllllllcweypptppfyekyppistbpj.r....kdpbbpjntvvpo.',
      '.....opvmjnsvxxvbxbppppppppbbbmbvgmmjlllcclllcwdypfjppydeewjpjoohpppjr.....kdbbpjntvxpr.',
      '....BpxmonomxgmgmpydeeeeeeedyypgbgywlllllcllledppftfpyewcccBrr..orohho......dpbpjnjvxpt.',
      '....sxxmohsxxmpyydeeccccwcceeedyyiacllllllccedhbfofpaeecccBAr.....rlr.......opbponjvgvpr',
      '...BfvxmshvxvbyeewccdcwwcccccceedklcclllllceyppfjtfdecwcBrr.......ru........opbpjnovgvpr',
      '...tgxxgqsxxgpddcwAkrrrrrrkkcwccABllcclllcdyppfttiowwcccA...................opbfsntxvgpr',
      '...tgxxmtsvbgyewAn..........AAkBAlllllclwdpppqjpptnkwcdn....................opptnomxgvpr',
      '..Bfxxxvtsvgpddi...............AcllllllwdpppstpbbptnjrB.....................oppsnjmxvbpr',
      '..tbxggmtsvgyen...............Aclcllllcdpbpsjppbbbhtnnu.....................thtnjmvxbgpr',
      '..tbxxgmusxbydn...............alllclcceypptspbpppbbhtnnt...................ohptntvbxvpar',
      '..tbxbxmjtmbpj...............Acllllccedppszeyppbbgvbmjnnju.................ohjntfvvvbpdA',
      '..tbxxbmtntmpj..............rAlllllledpptzeceypmbvbvmhjsnnr...............onoqntvvgvgpdA',
      '..tbgxxmtnjmpo..............rwlllllcdppqozccceybvbmmbgmptnjs.............jntnnjhxxvgbdA.',
      '..sgxxbvhjitpo............osAlwcclceypfrnkkcwcdybvbbmbxxhsnnuuu.ou..rr..rnsnnthbxbvgpeA.',
      '..sgxgxgmtntpia.........rjnjlllwwccdhprr...Awwceybmvbvxxvmojnnnjnu.risrrnnnntmxxvvbbydA.',
      '..spbbxxxmjnjfii...rr.iuntjklllllceypfr.....Awcceybbvbvxggmhjjtnnnonnntnnittmxxxbmgpdz..',
      '..zabvxgxxmsnnsnuu.qnsnntmhjlllllcdppo.......zccceypbvbgxxxxmvmsttjjoooojjmvxxvbmbpyBr..',
      '..AwpbvxxxbmjtnnnnsnnisjmvhAllllceypyu........rcccedpbvbvxgvgxxvvvvvvvvmmvbvgvgvbpywr...',
      '..Acdbbxxxxgvmtjjttttjsgxmjlwcclceppj..........Awccedypmbxxxgxxbxxbvxxxvbxxxvgvbpyez....',
      '...zepgxxbxxgvmmmmmbgvmbgmrlllcwwapio...........rAccceypbbxxvgxbxxxgvxvbxxbxvvbpyecr....',
      '...kwdbbgxxxxvxbxxgvgxbvbhAllllleypo..............AcccedppbxbvxxmbxvvvgvvbxvbbpddcA.....',
      '....zcypbxgxvgbvxxvbbvvbmfAllllceppo...............AccccedybgbbmbmxbbbvvbvvbpydccA......',
      '....zcedpbvxgvgxvbxxvbbpddAwclcceppo................AAwcccedyypbmpvxgvvvbpyydewcA.......',
      '.....acedypbvbvvvxvxpyydecAlwwceypii..................AacccceedyyyyyyyyyydeecBAr........',
      '......zcceeyyyyyyyyydeeeccrlllceppj.....................AaccwcceeeeeeeeeeecccA..........',
      '.......zccceeeeeeeeeecccwcAlllceppu.......................rAcccwccceccccccBAr...........',
      '........Aaccwcccwccccwcccwklllceppu.........................AAkcccwccccckki.............',
      '..........Acwccccwcccceccczwcccepfo............................AkkkArAAA................',
      '...........AAzcccBwcccBAAAkcwwweppo.....................................................',
      '..............AAAAAkkAr...Accccwypo.....................................................',
      '..........................Accccedpr.....................................................',
      '...........................Awwwceyhr....................................rrr.............',
      '...........................rcccceypo...............................rr.ooir..............',
      '...........................rcccceyht............................u.riijiio...............',
      '............................Acccwdbho..........................uioiquiis................',
      '............................Awwwceppj.........................oiuiqfiiqir...............',
      '.............................Accccybhu......................ruiifiiifiir................',
      '.............................rccccdppo.....................rijiiitofiir.................',
      '..............................kwwwwypho....................riiijouiiur..................',
      '..............................Accccdphhr...................riojnjittiir.................',
      '...............................Acccwappyj.................rroyyjiiiior..................',
      '................................Awwwepbbhjo.............rothfyriiuuu....................',
      '.................................Acccdypbbhjo........oojhphirrrrrr......................',
      '..................................awccedppgghjooorjjjhppppyi............................',
      '...................................racwcdypbphhhmqmmpgppfro.............................',
      '.....................................Azcccdyyppppppfppfor...............................',
      '.......................................rrAcedffpffforrr.................................',
      '..........................................rAArrrorr.....................................'
    ]
  },
  gyumao: {
    palette: {a: '#060101', b: '#020206', c: '#481809', d: '#0c0204', e: '#910d0f', f: '#290301', g: '#c60f0f', h: '#ba9969', i: '#9a7852', j: '#af6c2c', k: '#1a1e3b', l: '#090815', m: '#602f1c', n: '#5d6b81', o: '#2a354c', p: '#ccb081', q: '#8d522a', r: '#7b8ca0', s: '#b2c0c9', t: '#6a4530', u: '#16141d', v: '#530c19', w: '#2d2121', x: '#7b3f1e', y: '#1c0101', z: '#610615', A: '#3f4966', B: '#120102'},
    grid: [
      '..........................aab.................bba............................',
      '.........................asna.................brsA...........................',
      '........................wssa...................bssu..........................',
      '.......................wssa.....................assw.........................',
      '......................oispa.....................assiw........................',
      '......................bpspa........bbbb.........ahspb........................',
      '......................apssa......bbusrsbbb......asspb........................',
      '......................bhsssa....bnsoskrkrnb...aasssib........................',
      '......................bhpssstbaorrro..nornAbbapssspio........................',
      '.......................bhpssssbrnrro.ororAosbsssphra.........................',
      '........................bhhppronArrA.rrknAorbsphino..........................',
      '.........................aahibroabunnonABdlAnahibb...........................',
      '...........................BdwAmiiqwnnytiitdndda.............................',
      '.........................aBqqtltcmxiwwqqBdmmBqqxyB...........................',
      '........................dqqqxtwmtsdmtcqassxfwtmqqtd..........................',
      '........................syqxqldqms.fmmcBssmqduqqtff..........................',
      '.......................ycefBawcqqxxxqqjxxxqqywaBfeefB........................',
      '...................yfyyegeevaaqjjjjqhhjjjjjjxaazegeezyyyfB...................',
      '...............ffffeggzeggevadqjjicphipwtjjjxaaveggeeegggeyyyyB..............',
      '............sacgggzeggeeggeBdbtjtBrArsAruwjjxddBzggezggggezeeezy.............',
      '............bweegggeegeeggeBtdwtwunlnnbtduuqBatBeggeegggzzgggezvd............',
      '..........AlooBcegggeggeggeBtdoBmtyhddchytulodtygggzgggzzggezyBBdb...........',
      '.........borssAdyegggeggegeytBoyxxhBpppahxmloBtfggegggeeggeclArrnob..........',
      '........bnAssArAAfegggeegegzymdBmifdddBwcimuBtfggegggeggezybnrAsronk.........',
      '.......brnsoossrAsdvgggeezegfmmauwiimdiiiwlamfgggggzeggefdorsssoosnnu........',
      '......lrn.AorssAoAAdfegeeezzqfmmBwwwwowwwudmfgggegeegezBunAAossrAssnrb.......',
      '.....bnA.nn.AAArronAbBceeeezzxBywaboowowaBccegeggggezBaAArosroonsAsrknb......',
      '.....bAsorssnosssoAAAudfzezeezmBycBBwwbdfeeezegggeefdlAAnorsssksssoorAb......',
      '....aArsorsoonrrAnkAAdpqhymczvfeezezBayeezzzgggeeffthdAnkAAorAnAn.nArAna.....',
      '...ahonnroArrAknnnuuuhyhhhydwfeggzzzzzzzegggezzdyhihdhuuAnnnokrrAknrAnuha....',
      '...aqhuwrorrnkuuulhhhddpttpbbfveegggggggeeeecddbptthluppduulnknnronnkwhhw....',
      '....aqhpuuuuuthhhhtbdAAwhhanrAaBfzeeeezzfBBdorrnahhdAAldhhhhwlluluuuppab.....',
      '.....bathhhphhtaaadboArnddrsssnAAddBBddaorrrssssnblnAAkdbaddhhhhhhppcBa......',
      '......aadBBBBBBcmfdhknrrrrrrssssrrAuhlArssssssrrrrrrAAuhaBmcBBBBBBBymma......',
      '......BmxxqxxxmmmmBhkrrrrrrrrrrrrrAuhlnrrrrrrrrrrrrrAAuhamxxmmmmmqqxxmd......',
      '.....axqjqcxjjjxxmBhkArrrrrrrrrrrrAuhlnrrrrrrrrrrrrAAAuhdmxxxjjjxcjjjmmb.....',
      '.....axjjxxjjjjjxmBiuAArrrrrrrrrrAAuhlAArrrrrrrrrrAAAAlhawxxjjjjqmxjjjma.....',
      '.....dxjjmxjjjjjxmddpuAAArrrrrrnnAumhiuAnAArrrrrrAAAAuhludxxjjjjjcxjjjxd.....',
      '.....dqjjcjjjjjjxmdAahuuAAAAAAAkkthhhhhiuuuAAAAAAAAuuhbAAbmxjjjjjxmjjjxd.....',
      '.....BqjjmjjjjjxxmaAAlhhddddddfhpptdbbdhhhhBluuuuuwhhlAAAdmxxjjjjxmjjjxB.....',
      '....acqjjmqjjjqqxtlAAAadhhhhhhhdalonnnAbbaahhhhhhhhblAAAAlmxxxjjjqmjjjqta....',
      '....fqxjjqcqqqqqmdAAAAnobllllbaronrnssnnnkialllllllAAAAAAAatxxxxxcxjjjxxB....',
      '...BxjjjxqxcxxxmBbAAAAnnnnnrAwporrsnssrsnrkhwnnnnnnnnAAAAAbBmxxxcqqxjjjxta...',
      '..amjjjjjqxxcccyvdAAAAnnnnnrwhonnrsAsrsorrnwhwnnnnnnnAAAAAavfcccxxxjjjjjxa...',
      '..amjjjjjjjqqmBvvdAAAAnnnnnuhlArorArosororouihonnnnnAAAAAAavvBtxqxqjjjjjxa...',
      '..dyBaaaaBfqqmBvvBAAAAnnnnndporrsArrrArrrArruhwnnnnnAAAAAAdvvdmmtBBBBBdBmb...',
      '.aBqhpppppiBymBvzvdAAAAnnnupdArrsArrrArrrrrruhhonnnAAAAAAbvzvBtddippsphhaaa..',
      '.ahhuuuuuuthhBBvzvdAAAAAnnuhaAArnAnrronrrorrkahknAAAAAAAAavzvdaihqwkkkuuhha..',
      '.bukkAAAAkkuuhBzzvabAAAAAAuhdnAAAroAororAroorlhkAAAAAAAAbavzvahdukAAAAkkukb..',
      '.bukkAAAAokkkdfzzvBmdkAAAAuhdnrArrrArrrArrnnnlhkAAAAAoaytdvzvBbkkkAAAAkkkkb..',
      '..bkkAAAAkkkkBzzzvBmmdddaAlhdnAnArnoAAAonrAAnuhwAkddadmmtdvzzvdkkkAAAAkkkl...',
      '..bkkAAAAkkkuyzzzvBmmxxxwdaadbonouaadbbbloAAkkBBdyxxxmmmmBvzzzykkkAAAAkkkb...',
      '..bkkAAAkkkkBvzzzvymmmxxxxxxtddabtppppppaaaadBxxxxxxxmmmwBvzzzzdkkkAAAkkkb...',
      '..bkkAAAkkkufzzzvdAdcmmmxxxxxxxtaphiiitipatxxxxxxxmmmmwdbAdzzzzykkkoAAkkkb...',
      '..bkbllllllBzzzzvuAkbaawttxxxxxtahmhhphthatxxxxmmmmwabakoAlvzzzvdlllluuwkb...',
      '..bfihpppiiyzzzvaAAoAnbbadBmmmmwahhqhttthammmmmmdbbbbAnAknoyzzzvdhippphhua...',
      '..bhhaaaaBByzzzvbAknAkArroobaaaabBhhhhihBaaaddaboonnnoonklolvzzvdaaaBByhha...',
      '...afmqqqqxfvzvdokoororsAnsABhkAAAbdbbadlnnnbpbArsAsnnokoAooBzvvyqqqqxmBaa...',
      '...dqxjjjjqxfvvlAknronososskhBnonnnAnnnonnnouhwAssAsnoornkAnlvyBxjjjjjxtab...',
      '..baxjjjjjjjxBdAuAnrorsoAAsbhukAArrAsssorronoapusnoArrArnAkkobdqjjjjjjxxaB...',
      '..aaxjjjjxjjqdlAkonknrsnsAodhhornAAsosArAornkapaoAsA.rrorAknobtjjmjjjjxxBed..',
      '..baxjjjjfmjqdAoAnkknrAAssuhahkrrAsssAsrsArnkhBpussAArrooonknaxjxfqjjjxxyeB..',
      '..baxjjjmmymtbAlAnAnoAossndhahkrrAsssAsrsornuhapdsssoAArorAuAbtxymcjjjxxyeB..',
      '..baqxjjjcqaabkoAnArrAroskpddhknorAsAAAsArkkuhampkrArAsrorAAuobdqcqxjjxtfeB..',
      '..BBxccjjjqbbAkAkonrsAssAupadhkArrnAAsAonrnnuhdBpuAssosrroooAolaqjjjxcmffeB..',
      '.yeefqxcqxxbAlAnnkonsnssopdBBhknrssAsssnsrnnkhdahpossnsnkknnAkAbqqxxctmfggy..',
      '.yegeBymByBbAuAnorrAoosrlpBmyhkknsrAsssArrokkhBmapussooornonAkAbaBdBwByegged.',
      '.yegeyvvvvvBbAAnorrsosolptBmyhknAoosAsAroonnuhdmBhpkkrAsrnorAAbaavvvvvfgggeB.',
      '.yegeyvzzzzyhulkArrossrupammyhknrAsssArrrornkhammBpkrrrorrAkuuhhBvzzzvfgggeB.',
      '.yegeyzzzzzvfhhuuorArsupiBmmyionrAsssAsrrorowhdmmfhpksroroudhhhBvzzzzvfgggeB.',
      'sfegefvzzzzzcfhhhluuAkhpBmmmmdpwArosArAsArodhammmmfptoolllhhhyBvvzzzzvfgggey.',
      'BeggefzzzzzvymyyhhhhuupBmmmmmdppurrAnnnArnahpammmmmBpuuhhhhyfcmBvzzzzvfgggezr',
      'yeggefzzzzzvBxmmBBfiihmfxmmmmwBhhunnrrrrnuhhBdmmmmmBmhhhBBBmmmqBvzzzzvfgggeed',
      'yeggefzzzzzcyxcxxmmByyfxxcxmmyvBppuAArAABhhyvvymmqqxfBBytqqqxmqyvzzzzvfgggged',
      'yeggefzzzzvBmqcqqqqmxxxxcqxmdvvvfppuuuudhhBvzzvymmqmmmmqqjqqmcqmyvzzzvfgggged',
      'yegggfzzzzvBmqmcqqqqqxmcixfmdzzzvBypppphdyvzzzvBffcqqccmcccqcqqmBvzzzvfggggea',
      'yegggfvzzzvymqqccqqqxmxqyytmBzzzzvvBBBByvvzzzzvBmqxfqxxxxxxmcqqcyzzzzvfggggea',
      'yegggyvzzzzvycxqfmmmmqqyctqmyzzzzzzzzzvvzzzzzzzymxqxfxqxxxxcqtBBvzzzzvfggggea',
      'yegggfvzzzzzvaBytcctqmBmmtmBvzzzzzzzzzzzzzzzzzzvymxxtfcxxqctdaavvzzzzvfggggea',
      'yegggzyvzzzzvdhhBddaaddBBddvvzzzzzzzzzzzzzzzzzvvvaaBBBddddBBpiavzzzzzyegggged',
      'yegggeyvzvvvBakopppphhhhhtaaaBvvvzzzzzzzzzvvvvdaaahhhhhhppppukbdvvvzzyggggged',
      'yeggggyvvaaa.bkAkkkkkkkkkb....aaBvvvvvvvvvaaaa....bkkkkkkkkkAkb.Badvvyggggged',
      'hzggggBaa....lkAAAAkkkkkkb.......Bdaaabbaa........lkkkkkAAAAAkl....Bayggggged',
      '.fggggf......lkAAAAAkkkkb..........................bkkkAAAAAAkl......yggggeea',
      '.Bzgggf......loAAAAAkkkkb..........................bkkkAAAAAAkb......yggggzB.',
      '..yeggyA.....bokkkAAkkkkb..........................bkkkAAAuuwtb......fgggeB..',
      '...fegea.....aihhhuuuwha............................ahuuuuihhha.....yeggya...',
      '....Bfxa....bkkkwhhiiiwa............................auijjhhykkub....BefB.....',
      '......aa...lkkAAAuuuukkb............................bkuuuukAAAkkb...bd.......',
      '..........loAAAAAAAkkkkb............................bkkkooAAAAAokb...........',
      '.........bkAAAAAookkkkkb............................bkkkkkkAAAAAAub..........',
      '.........boooookkkkkssrb............................bssskkkkkkkooob..........',
      '.........ussssss.sssbbbb............................baaa....ssssssa..........',
      '.........baabbbbbbbb....................................bbbbbbabbbb..........'
    ]
  },
  chichi_nina: {
    palette: {a: '#b08b9a', b: '#41253b', c: '#afaab3', d: '#eda7bf', e: '#0d0003', f: '#c55c8a', g: '#ce9c8b', h: '#030105', i: '#2f010f', j: '#fff0e6', k: '#030001', l: '#e0b9a1', m: '#f8ccb4', n: '#170205', o: '#000002', p: '#080309', q: '#4a4d6d', r: '#8a7490', s: '#8f5261', t: '#3e779a', u: '#02020a', v: '#0d0c10', w: '#dd779e', x: '#e887ae', y: '#fd85b1', z: '#f48db6', A: '#070001', B: '#020616'},
    grid: [
      '........av.........',
      '.......cq.o........',
      '.......hc.o........',
      '.......occp........',
      '......eif.beb......',
      '....csfffcdwgee....',
      '....bwwzfcdddwwe...',
      '...efyxddsdxadxwe..',
      '...nwwdddf.ddfdxn..',
      '..efwffffa.adffwwA.',
      '..efffcccccccccwwA.',
      '..effcaokAkkkkhcak.',
      '..effcoknlkAAlkkck.',
      '..AffcknsgeAegekco.',
      '..Aafckgmjggljakco.',
      '..oafckbjkmmAjbkck.',
      '...hrcAgjemmkjlAck.',
      '...hroAlmmmmmmlkk..',
      '....hhegmmfsmmsA...',
      '...eehAeslllgbkh...',
      '.pexweoonnnnneppee.',
      '.o.sffAAbfffbrniwwk',
      '..uossrbabbbcbrffn.',
      '...egavarrcgrrpnA..',
      '..eslgBqrrqqqqkgA..',
      '..vlluqqqqllrqkgh..',
      '.hccskhuBBvupkorch.',
      '.httpAballlllsptch.',
      'hlloaifbbbbbbxsegmk',
      'hlbliffwzzzzzyznsmk',
      '.kkeffyyyyyyyyyweh.',
      '...pfwyyyyyyyyzwe..',
      '...hknraxxxxxseAo..',
      '.....BtttuAbtth....',
      '......uBuu.uuh.....',
      '.....psssp.kssA....',
      '.....Awwvh.hsfak...',
      '.....hhhh...hAeo...'
    ]
  },
  shu: {
    palette: {a: '#070102', b: '#96714c', c: '#443835', d: '#544d77', e: '#02020e', f: '#0a0307', g: '#855b32', h: '#67442a', i: '#29264f', j: '#24203b', k: '#150a13', l: '#cfb58f', m: '#cdab7b', n: '#9f989c', o: '#faf1e3', p: '#322f5c', q: '#3d3867', r: '#6a6991', s: '#4a4775', t: '#1d0608', u: '#872624', v: '#010105', w: '#130201', x: '#04031d', y: '#5b578f', z: '#52528d', A: '#5a5583', B: '#110f31'},
    grid: [
      '.....a.......cn.......',
      '....wba....ltgw.......',
      '...agbhv...ahbha......',
      '...agmga...wbmha......',
      '...agmbcxxkhbmha......',
      '...vglssyyAdimhf......',
      '...vjqrrnrnrApie......',
      '...esqn.....Appx......',
      '..vqskkffffkkBppe.....',
      '..vqfbgghhhgggkie.....',
      '..eqhboogggooghie.....',
      '.epqhooagggcoohijv....',
      '.edjhooogggoobhjiv....',
      '.xAabgbgmllbggbeixv...',
      'eqdvmmllnfalmmmepiv...',
      'vpjahllltfcmmmheiiv...',
      'vvvlallllmlllneeeev...',
      '...eqfbllcllbjpe......',
      '..eqipektttkapqqe.....',
      '.xsqyxdebbjseAqqse....',
      'epsBAyxdeBsizyijsqv...',
      'esBexqpespxsqpjeBsv.a.',
      'edqfwttwttttttkessv.ga',
      'evntuuuuuuuuuuhknv.agv',
      '.vfnwffaffkkkkanalagwv',
      '..ekpqseAizsssBxkahha.',
      '..eqqzdxAsyzzzzifgga..',
      '..eqyyiixppzzzzqeff...',
      '..eqyyqiexipzzzpe.....',
      '..vBpppiv.eiippBv.....',
      '...eexee...exxxe......',
      '...aobv.....amla......',
      '..vggcv.....vhggv.....',
      '..vaav.......vaav.....'
    ]
  },
  pilaf: {
    palette: {a: '#30020a', b: '#640e18', c: '#cd0f0d', d: '#0f2469', e: '#f1d653', f: '#091943', g: '#010204', h: '#02081b', i: '#3091b1', j: '#304521', k: '#167193', l: '#55c1e1', m: '#030c2d', n: '#a2b1ba', o: '#01050f', p: '#578c2a', q: '#7b7f86', r: '#11092e', s: '#f1e8e8', t: '#921d25', u: '#b75656', v: '#ad1d18', w: '#fbadaa', x: '#271559', y: '#512544', z: '#340f44', A: '#a92d36', B: '#0f0002'},
    grid: [
      '............B...........',
      '...........avb..........',
      '..........Btvt..........',
      '..........BaaaB.........',
      '.......nfbcvbccbhn......',
      '.......ryccvbcccym......',
      '......hxvccvbccctxo.....',
      '.....nmyccvpebcccyh.....',
      '.....oxyttteveattyfo....',
      '.....hdrrrBeeehrrmdg....',
      '..g..ohmmhmhohmmmmhg..g.',
      '..gonomdilllllllldhg.fg.',
      '..glofkllllklillllkhhlo.',
      '..oikikkllllkllliikiiko.',
      '...fkkidskililiksdikih..',
      '...oidiissldlfnssiidio..',
      '....oikliiilllkkklkio...',
      '....gkdllllllllllldko...',
      '...g.hhilllhhmllliho.g..',
      '..gnnsqmklllllllkhisnng.',
      '..gqnq.sfmfiiifho..q.qg.',
      '..gq.q.qs.sdsfsnsq.q.qg.',
      '...gjq.qq.q.q.q.qq.qpg..',
      '..gppgysqsq.q.q.q.ygppg.',
      '.gppjhfmrz.rfosrfrmojppg',
      '.jppodddzAvsswvAxddxgppj',
      'g.ppmddxAuwAsAsuAxddojj.',
      'gn.nmddzAsusvwvsAxddoq..',
      '.om.mddzAswvwcccAxddhnfg',
      '.onomddxAwvwsAssAxddmolg',
      '..oofdddzuwvsvsuxdddfoo.',
      '...gfddddzAsswAzddddfo..',
      '...grxxxxxzzzzzxxxxxzg..',
      '...BbtAAttttAAAAAAAtbB..',
      '....BBBBBBBBBBBBBBBBg...',
      '....q.Bjjjg...gjjjg.q...',
      '.....attttg...gttvAB....',
      '....gggBBB.....gBBBgg...'
    ]
  },
  umigame: {
    palette: {a: '#080100', b: '#150200', c: '#ba8340', d: '#8a511b', e: '#5a2703', f: '#a06c39', g: '#824814', h: '#320b01', i: '#825027', j: '#040001', k: '#945922', l: '#462413', m: '#c69552', n: '#441804', o: '#734528', p: '#0d0200', q: '#673720', r: '#d5b885', s: '#35140a', t: '#925f2f', u: '#a07c50', v: '#562e1e', w: '#7f5d3d', x: '#75706d', y: '#733c13', z: '#010200', A: '#040205', B: '#1e0a04'},
    grid: [
      '.................aaaappaap..................',
      '..............aaBttfcccftipaA...............',
      '............abqdfeeikkkkkkmloba.............',
      '...........bfygccccnettkkddonitaj...........',
      '......aaBxpitkcddddkfnnnidiiintova..........',
      '....apmcuBplvnkddddkqncceqyihuhoyla.........',
      '...Buytenffbblhiiddkeffdtnonfgihqfoz........',
      '..ptyctrrecobffhhoyihfdddihfdddihtqj........',
      '..bmccoaArtiqllifhihttddddytddddvhooj.......',
      '.acmccqalremoppbothqidddddynidddihoqb.......',
      '.acfccctmmremilblthnqqidddqniddiohoqoj......',
      '.accmmmmcfrrctBupvtvvqqqdivsidyyyqhqqpa.....',
      '.vfwapbBBrrrmdifpbqfinqqqqqsqqqqqqsqsobaz...',
      '..aBfurrrrrrcdcttBboiihnqqqsqqqqqqlhqvpuz...',
      '...laammmfucccckiupblotthhhsqqqqqssqispA....',
      '..pntwaajapppvqqubttbboottfhhhhhBsonqbB.....',
      '.bqcktwwB.luuwpppBidtvBBvqolttttoovlbvsapa..',
      'joccujjz...jaurrpccdtywwbbssoqoovvbpweffiwz.',
      '.aajA.......xxzatycmctbhmraaaapzAAAwftyyceuA',
      '...............zfygcdckobmwrrrrzzA.jjuuuoua.',
      '...............zucgmkcmdoaajjjz......jjjjj..',
      '................zmmycdgmfwa.................',
      '.................aiggmmyycwb................',
      '.................Apmcmymcfywa...............',
      '...................zbcmmyycyqz..............',
      '.....................zjptcctwj..............',
      '........................aajjA...............'
    ]
  },
  roshi: {
    palette: {a: '#010103', b: '#08010b', c: '#f1f2f2', d: '#a74628', e: '#bb5a25', f: '#8f5e42', g: '#df6419', h: '#070101', i: '#cc805f', j: '#663b26', k: '#9d2c0a', l: '#01020b', m: '#8e679f', n: '#f2b994', o: '#1f203a', p: '#ec8228', q: '#240302', r: '#abadb1', s: '#ce4d09', t: '#fc8315', u: '#411307', v: '#130101', w: '#0f0e2b', x: '#404f9a', y: '#70507f', z: '#523864', A: '#18225e', B: '#060218'},
    grid: [
      '........................hhhhhho................',
      '......................hvnnnnnnnh...............',
      '.....................qfnnnnnnnnnj..............',
      '....................hinnnnnnnnnnnv.............',
      '....................hinnnniinniinih............',
      '...............rBBbbhiinnnnnnnnnifb............',
      '.............rBBmmmyhiinnrrrnniinrw............',
      '..........rwbBymmmmzhiiincccynnnncra...........',
      '.........bzmyzmmyyzbvuiinnnnninninmh...........',
      '........Bmmymmzzzllhnnkinsdddiniddja...........',
      '.......ommymmzlaallbndnkkdoozusdooia...........',
      '......BmmzmmzbaavvhhninnedooyuskAofa...........',
      '.....bmmzmmzhvvqjijqnjinnkooyfnnojfh...........',
      '....bmzzyzBvusppeuffviiinnkkkdnnkdv............',
      '...aommyyhqkstttgjvfvhiiennnnunrura............',
      '...wmmymlvettstpqvjjfhhiidjzcchhcaa............',
      '..bmmzmybqgtttseqfjefjvfihcccc.c.cla......hhh..',
      '..bmzyybqsttttdqfjeefjvfh.cccrBrccca.....vjfnh.',
      '.hmyymmqgtttttdvjeejfujhr.ccmo.orccyw...andnnnh',
      '.bmzymqetsttttdvjfdjjuja...yor..orrya...anuienh',
      '.Bymmvgpppgspsdvfujjuveh.rlm.cc..lrov...hifnnna',
      'bmzmvppkkkkekkdufjjvqgehllrccccc.hhhfh.acvjndnh',
      'bmzyqpkttpequdqjjjqptteyml...ccc.vekedvc.hnunih',
      'byovetttsec.rhhjjqptttprlma..cc.rqggeufccqjiiv.',
      'byovsttpnccqinifqfttttpr.mzlr.crvsggupeccuiqha.',
      'bzyvsttec.jennnnnqttttpccrzrlr.aveggktsncmaa.a.',
      'boyvestecrjennnijqttttpcBwlrfhrvvdggstterroora.',
      'byyzvdsdcrbfnniifugttticcw.rejqfvudssttsrrrrra.',
      'byzyhqdjrrhvfnifqptstprcco.isedh..vdssssdrrrl..',
      'ozyyahvjmmhjvvjustttssrwowqssev....qeeeeeval...',
      '.byyaahvhaqfjqusstttte..orrssev.....vvvvh......',
      '.bzwaavdfqfjussstssttp.co.nsseq................',
      '.bzyBlvfvfjqsssssttsskrBwafstgev...............',
      '.byzzbfvvfvqsstttstttsrrwrrptsseh..............',
      '..yyAlhhfjqsstttttsstp.cw.csstttdv.............',
      '..byyohfjvesttttttttse.awlrpttttpjl............',
      '..ayzbvfhbqkptttttttpn.cBccnptteqBAl...........',
      '...byvffBAAbqepttttti.clwlc.ipehwxxxB..........',
      '....hffbAxxxobqspttpccywABacrfhAxxxxxl.........',
      '....hfbAxxxxxxAhqeen..lAAAlalBAxxxxxxxl........',
      '...hjhlAxxxxxxxAobhaaaaBAAAAAxxxxxxxxxl........',
      '...hjrlAxxxxxxxxxAABzzyllBAAAAxxxxxxxxl........',
      '..hfhllAxxxxxxxxAABzyal..lBwwAAAAAxxxAl........',
      '..aoBABAxxxxxxxAAlaba.....owABwAAAAAAl.........',
      '...lAAAAAxxxxxAAla........lAAAAAAAAAol.........',
      '...lAAAAAAAAAAAwz..........BAAxxxxAAl..........',
      '...BAAxAAAAAAwol...........loAAxxAAol..........',
      '....BAxAAAAAAAB.............llBAAwwl...........',
      '...aBAxxxxAAAol..............BAAobh............',
      '...hzwAAAAAAll..............afnnnnja...........',
      '..hinoAABlal................aBwznnnnll.........',
      '.abnnnnBl...................arowwwooool........',
      'aBwnnnwol...................almrrrrrrra........',
      'Boooooool.....................aaaaaaaaa........',
      'Booooozl.......................................',
      'a.....l........................................'
    ]
  },
  chichi: {
    palette: {a: '#010109', b: '#040408', c: '#010204', d: '#0a0100', e: '#28120d', f: '#010101', g: '#c69784', h: '#fddfc8', i: '#ecb598', j: '#010e06', k: '#4a8735', l: '#25312d', m: '#419321', n: '#021d02', o: '#030202', p: '#494864', q: '#010601', r: '#a87766', s: '#3e990f', t: '#535475', u: '#1f591b', v: '#104609', w: '#000b00', x: '#196c0a', y: '#2d741d', z: '#030410', A: '#141520', B: '#473f43'},
    grid: [
      '........ccffcc........',
      '.....gfbooooccca......',
      '.....cbBoobfcccfA.....',
      '....pclBBbBfcApfc.....',
      '....cfBofpbccBcffA....',
      '....fffffobbffffcc....',
      '...cfffffffoffffcc....',
      '...cfffdefdrodffcc....',
      '...cffodgfdgdgffcc....',
      '...cofodiodidgfcff....',
      '...cfoddiddgrrdcff....',
      '...odfrBBgiiregooc....',
      '...dgdehdgiiohedgf....',
      '...lgdghdhhhdhrdgo....',
      '....fdgiiiihhigffB....',
      '....ccdgiirhhgoffc....',
      '....ccfdgihigdoffc....',
      '...qqqqqdBrrdqnqoo....',
      '...qnwmmqrrglnkjkbp...',
      '...qywysywoqyxmwkvc...',
      '..gvmnysmvqnmvmnmmb...',
      '.tvmywysxknkvmyvxmn...',
      'rvmmuwxmmnkvmsunymw...',
      'bmmvv.wuvkvxxxuqxyu...',
      'bunqq.jlqvuuuuqlusmf..',
      'bbppzc.bccqqwbc.wmml..',
      '.zlppbbptttttBc.nuyka.',
      '..zABrfbqcqqqcq..ccqb.',
      '...dgqkwkvmsxmyw.cpta.',
      '..errwknkxssssmvqcltz.',
      '...ofkvywsxsssmkqbbppc',
      '....cqwywkmmmmunwcrppa',
      '....wkjqqqwqqqnmuoipta',
      '....vsmyyuwuumssyqdga.',
      '...qmsssxujwmsssmvfd..',
      '...qssssyufqxssssyq...',
      '...jssssyw.wyssssuq...',
      '..jxsssmvw.quxssmvw...',
      '..jyxssxuq..wyssmuj...',
      '..jxxxxxvq..quxsxxuq..',
      '..jxxxmxuo..qvxsmxyc..',
      '..lymmxxBb..quxxxyuA..',
      '...juuuuq....quuujb...',
      '...bjjjc......jjjzb...',
      '...atpBc......zpplb...',
      '...cttzc.......zttc...',
      '...atBa........zttc...',
      '..ccczc........bzaff..',
      '..zpplc........zlBBz..',
      '.apppAc........azBppa.',
      '.cazac...........aaab.'
    ]
  },
  puar: {
    palette: {a: '#050e19', b: '#010104', c: '#326a88', d: '#ddbb99', e: '#7a8c93', f: '#295a75', g: '#4d7584', h: '#646e6f', i: '#bbb3a1', j: '#c9bdab', k: '#32779b', l: '#abb8ba', m: '#dabfa2', n: '#01060f', o: '#a48975', p: '#3d6279', q: '#437994', r: '#194158', s: '#bc9e81', t: '#8d7462', u: '#d1b291', v: '#3a545f', w: '#423b36', x: '#dab993', y: '#d4ba99', z: '#0e283b', A: '#061929', B: '#020409'},
    grid: [
      '...................nz.....b.....',
      '..................aqfB...nqb....',
      '.................Bcpen..Bfgb....',
      '.................acuown.nfiB....',
      '................bcgdmhAncvjpB...',
      '................nfiddiAnfimeB...',
      '................afymteAaAimjb...',
      '................acjhffkckrAjb...',
      '................Affcgjgeg.pzb...',
      '...............nfkkhjhjhjhjpn...',
      '..............Arkkgyxxydxuuirh..',
      '..bbbw........ackklxxxydxuxjgn..',
      'he...ew......Brkkkkixxadywy.cn..',
      've.llkkw.....Bckcrfvydtddwmgrrb.',
      '.baBvqkkn....nrrrresomdxxmmofrbb',
      '.....aqkr...BnapccpmddwyytmjcpB.',
      '......nkqb.....brpjddxywwsyern..',
      '......Bkqb......nnaouuuymssnb...',
      '......BcqB....aAvpgwttoohBb.....',
      '......BcqB...ncpiiuusssssvvB....',
      '.......Bqa..BqvjzvmdxxddmsshAr..',
      '.......ncqA..nbbzjdxxxxxmbbevB..',
      '........AqpnB..Bqjxddxxxmb.Bb...',
      '.........BnpcfzAqiyxddxutB......',
      '...........bBnackgtsymoob.......',
      '.............nfkcBbbBnnb........',
      '.............nkkn...npn.........',
      '.............nqfn...apn.........',
      '.............bnB....eb..........'
    ]
  },
  yamcha: {
    palette: {a: '#040d02', b: '#030001', c: '#000001', d: '#110101', e: '#010205', f: '#d1c6c4', g: '#010201', h: '#ae4010', i: '#ecaa7c', j: '#5b1505', k: '#bb7b57', l: '#6f3922', m: '#a05932', n: '#346923', o: '#250502', p: '#3d3e5e', q: '#131516', r: '#2e2d37', s: '#1b5619', t: '#3f8b2f', u: '#120a05', v: '#332514', w: '#5f637b', x: '#03050c', y: '#a2a5ad', z: '#888b96', A: '#080101', B: '#e1671f'},
    grid: [
      '...................ee................',
      '...............eeccyee...............',
      '........eee...errrggeer..............',
      '......pqrrqeqerccccgeerc.............',
      '.....reqqxrrergcccgcgucce............',
      '....ppppcccreegggcccccccew...........',
      '.......feeccggggggcccccgp............',
      '......yqeeccgggxggcccccge............',
      '.....yqrrrcccgereegbbbggge...........',
      '.....qrrgccgccrxbdbbbbgggc...........',
      '....erccgcxrbdrbdmbArbgggc...........',
      '....eee.eerbokbAmkAlkAgggee..........',
      '....ew..cgeAmkAlikokldbggee..........',
      '....r...cggAdkdkiokzdlgggeq..........',
      '........cgbdAbukiikudAAggc...........',
      '.........edkoirdmjdiivmbge...........',
      '.....fe..gAkoifliilfkopge............',
      '.....cc..ggbqkiimiikmqbbbc...e.......',
      '.....ee.cggbAmiimiikmbggggeege.......',
      '.....egeggbbbokiimkkdcggbgeegc.......',
      '.......eecAdbljkiiijldddAggc.........',
      '......cdAohldmmjjjommohlddbce........',
      '.....AohhhBhjkimmmlikjBhhhldbe.......',
      '....coBBBBBBhjimiimijBBhBBhmdA.......',
      '...wAlBBBBBhBhlijjkjBBhBBBBhmA.......',
      '...bAdjhhBBBhBjjBBjhhhBBhhmoodb......',
      '...AklloolBBBjmjBljhlBhhmojkmib......',
      '...AkimmluuujBjjjjhhBoAgAlmkiic......',
      '...AiimjmstaBhBjhhjBBBatsBokiib......',
      '...lkkkjlstABBljfiljBBatsmlimkA......',
      '..AikiikgstAmjvfmyvjlmansukiimiA.....',
      '..Aiiiikgstaolfhkvkiddansukiikid.....',
      '..Akkiikgstnmf.mfollvlnnsukiikiu.....',
      '.yjimikvgsnnmmfflmdvlvnnsglkimiq.....',
      '.Aiimkkw.qsnnmmffkfolluvv.ommmikb....',
      '.jiiimd..gsssslmmhlldllvkA.dmiiid....',
      'dlkiikd...eeeeeeAAAAAvjikA.ukiiilb...',
      'xrppkmr...ewwwwpwwwumjkiow.Akkppre...',
      'xpwprA....xpwppwwwwAkkkgwx..Apwwpe...',
      'xpwwpx...cggggbAeexaaggwwzx.xpwwpe...',
      'xpppxe...asssnumvntssssewzzexqpppe...',
      'ArllA...gsststvmvttstssqxzzz.dmmrx...',
      'AkiikA..gsstttnAmsttttssapwzdkiimb...',
      'Akiiiic.esstttnAdmsntttssxwriiiikb...',
      'Akiilkvgssttttlmddmntttssseqiliikb...',
      'pkkiljvasstttnkuyrdmstttssgullikkA...',
      '.Arkku.assttvmvwywwvmsttssakdkkdd....',
      '...bbw.asnvmmdfwzwwzjmmnssazuqrpx....',
      '......AolmmAw..yzpyyfvommnqu.eppwx...',
      '......Ammor....ypry...yuvmmd..xpppx..',
      '......bAry.....zxxz.....yvAb..yqppxw.',
      '......gwf.....yzexzz......pc...xrriu.',
      '......cy.......zxew.......zc....bkBib',
      '......cy.......pe.xy......zg.....AmiA',
      '......ez......zc..ey......yx......uvx',
      '.....eyw.....zze..gwz.....zye......f.',
      '.....e.wy..yzyx....ryyy..ywfc........',
      '.....g.yyzzz.zr....pz.yyyyz.c........',
      '.....g.zyyz.zzp....wzf.yyypfc........',
      '....ew.y...fwfe....xfzy..ypfze.......',
      '....eyw.zyzw.ze....xzfwyyp.wfe.......',
      '....eyy..wz.ze......xz.zzw.ffe.......',
      '....ezyzw..rzc......ezzfr.zzze.......',
      '.....euzzzzzzc......czwzyzywe........',
      '.....dlddddux........AdddddAb........',
      '.....dhhhhhmd........dmhBhhhb........',
      '.....dhBBhhd..........ohhBBhb........',
      '.....dBBBBhA..........oBBBBBA........',
      '.....ohBBhlb..........dlhBBlb........',
      '....xyfjllAb..........polllfye.......',
      '....x...rex............buq...x.......',
      '...xrrrrrze............ewrrrrrx......',
      '..errrrryx..............qyrrrrre.....',
      '..e..f..e................e.....e.....',
      '...eccce.............................'
    ]
  },
  oolong: {
    palette: {a: '#0a0101', b: '#9c473c', c: '#f5b99a', d: '#ae6153', e: '#fee7d8', f: '#0b0405', g: '#f4ad8f', h: '#c67969', i: '#160b0a', j: '#3c271e', k: '#d98d75', l: '#f9c2a3', m: '#b3adac', n: '#e3a187', o: '#0c3d3d', p: '#42423d', q: '#1c5451', r: '#705245', s: '#254374', t: '#226764', u: '#020813', v: '#0a5150', w: '#25756e', x: '#1f706a', y: '#010306', z: '#0b1639', A: '#0a201f', B: '#132753'},
    grid: [
      '....aaA.............maaj....',
      '..mrlccfa..........frccci...',
      '.mjclhdcni.aaaffi.angdklca..',
      '.rclnbdbgnaccllllakgbbjllcj.',
      'fnclbdddbgcclllllgnbdbbblcny',
      'fnllbhbbbgnbllllbngdbhhblcna',
      'anghbhhbgndchllhgdgkhhhrhgna',
      'anmaadbkgcllhlldcclnhdhaanma',
      '.yp..ahhllllllllllllkhf..fp.',
      '......aklc..ecc...llha......',
      '......fhle..acca..llha......',
      '......fnlg..enke.enlna......',
      '......fgkkhlknldlkkkga......',
      '......fgccccnbbkcllcka......',
      '......akcccgdgcbccccka......',
      '......rdgccdkhhkblcndp......',
      '.......pdnncdddbggnrp.......',
      '.......myihkcccgkduu........',
      '.....myuoouurbrfyyoouu......',
      '.....Aqqvvvqodjwoootxtu.....',
      '....uxwotxqAoooooottvwqy....',
      '....owwAttAdqvvvxxvqowwy....',
      '...yxwtuoroArtxxxxwvuwxty...',
      '...uxwqAqprooxxxxxwxAvxty...',
      '..ytxtAudpptxxxxxxxtouxxty..',
      '..uottuqArotxxxxxxxooytwqy..',
      '..y.AuyovqtxxxxxxxxtoyAA.y..',
      '..y..myotvvvxxxxxxxtoym..y..',
      '...aiyyoxxwxxxxxxxxxqyify...',
      '...anhyoxxwxxxxxxxwwqahna...',
      '....yayuovvwxttttwqoyyaa....',
      '......uzuuuuyyyyyyuuzu......',
      '......uBssBBzzzzBBssBu......',
      '......uBsssBBzzBBsssBu......',
      '......uBsBssBuuBsssBzu......',
      '.......uBBBBzu.uBBszu.......',
      '.......uzBBBu..uBBBzy.......',
      '.......afyyuy..uyuyiy.......',
      '......arrpjyp...ajrrpy......',
      '......yayay......yyayy......'
    ]
  },
  bulma_joven: {
    palette: {a: '#b8bdb9', b: '#0c2c3e', c: '#175572', d: '#439eba', e: '#337b94', f: '#28792e', g: '#060e20', h: '#8b6e69', i: '#e3ac96', j: '#4f3862', k: '#7d4592', l: '#e672a2', m: '#e8ccda', n: '#050610', o: '#b7365c', p: '#c47e68', q: '#310c12', r: '#190207', s: '#6b252e', t: '#f97fb0', u: '#c85890', v: '#010308', w: '#c89784', x: '#0b0102', y: '#f4c3a7', z: '#020101', A: '#391a32', B: '#6ac5e0'},
    grid: [
      '....arrA....rrA................',
      '....qooor.yqsoox...............',
      '....qoooorssoosz...............',
      '....rsssAgnggnnv...............',
      '...nssscedBBdBBBb..............',
      '...roscdBeBBBdBBBb.............',
      '...rsgedBBdBBBdBddn.e..........',
      '...bgcdddBddBBdddddeme.........',
      '..negeddddddadadBdBBc..........',
      '..gegeeddeaeyaeaeaedBe.........',
      '...cgedeeeaeiyeaeaebBe.........',
      '..vegeeeaewehyeyejeced.........',
      '..gcgeeewhwiyihyhwedc..........',
      '..nencbjwyhjjiyypqed...........',
      '..ndenwiwir.dyyme.z............',
      '..beezweeiv.eyymc.x............',
      '...ggzphewh.cyyyAand...........',
      '..bec.Aheiiyyyypyh.d...........',
      '.veden.vvhiyyiyiyz.a...........',
      '.veden...xhyyyiyx..............',
      '.vbden...vrspiwx...........vz..',
      '..vdn...nkkuAAAjg........zv.z..',
      '...v..arqkjkuulkAn......za.az..',
      '.....ruuuAkkkkkkkxz....zafffaz.',
      '....slttulskuuuuAulv..z.ffffawz',
      '...qutttlltlAjjstour..zaffff.qz',
      '..xlotttuttmmmmymisux.z.ffffhyz',
      '..rslutuouljj.k.j.quux.zaffmsav',
      '.xpislouqulAmAmj.krox..zAaaqiz.',
      'qsyyhqurqoulllllulrrixxxphpwx..',
      'ziywrqx.qouoooooosrpisyyjhrA...',
      'riyyyA...xouutuugbnpiyyyqA.....',
      '.ziyywraazxxrq.bcednwiiz.......',
      '..zpwqsxxxAsssabccBgxxx........',
      '...vxsssrhAsAAqgceen...........',
      '....zxqssrloluuAceen...........',
      '.....xqssqlututogggv...........',
      '....vrssqluttttotoux...........',
      '....xqqruluttttuttur...........',
      '.....rootlutttttttoux..........',
      '.....ruutottttutttolx..........',
      '....quotuuttttuttttulz.........',
      '....xqutulttttuutttouz.........',
      '......xrquttttuutttrx..........',
      '.......rpsooooooosx............',
      '.......rppppxxppppx............',
      '.......xyyypvzpiyix............',
      '.......xyyyhjxpyyiz............',
      '.......qyyix.xpyywz............',
      '......xpyyix.xpiyx.............',
      '......xypix..xiywz.............',
      '.....xpyywz..zyyyz.............',
      '.....xiyyyz..zyyyz.............',
      '.....xwyyyz..zyyyz.............',
      '.....xwyyy...xyyyz.............',
      '.....xwyyx...xpyyz.............',
      '.....xwyiz..vxqpwx.............',
      '....nAopsx..vjkkkkv............',
      '....rkuuun...njkkjv............',
      '....njkkjv...vccdBv............',
      '....gdBdna...nccdcv............',
      '....gcccv....vceeBBv...........',
      '....gBBcv....vccceBav..........',
      '...veBBdv....vBcceee...........',
      '...vedeen....vvvnca...v........',
      '..gv...en........bvzzzv........',
      '..bz...ja......................',
      '....zzzA.......................'
    ]
  },
  raditz: {
    palette: {a: '#2f3139', b: '#020207', c: '#02041a', d: '#5a6ea9', e: '#010103', f: '#01030d', g: '#000200', h: '#020703', i: '#0a0a12', j: '#030101', k: '#22222c', l: '#121218', m: '#080101', n: '#0f0102', o: '#cb8055', p: '#c8c8d4', q: '#f3c9a8', r: '#702e41', s: '#3fe07a', t: '#453c60', u: '#33262f', v: '#5a3a1c', w: '#1f161d', x: '#8a5a30', y: '#4a3a44', z: '#0a010c', A: '#1d0103', B: '#8e1f2a', C: '#1c1624', D: '#2a2233', E: '#d6333a', F: '#120e18', G: '#f4f4f4', H: '#8a8aa0'},
    grid: [
      '....................abcc...........',
      '.................dcaea.............',
      '.................faee..............',
      '................fagec..............',
      '...............baaee..heeegf.......',
      '...............fagef.faaaaaac......',
      '..............haaggeaaaaeebeaf.....',
      '..............eaagggaaeggbaacac....',
      '.........ii...baaggjaeejeafc.......',
      '........iklieggeggegggggac.........',
      '....fb.ikklfggggggeeeegfg..........',
      '.....fjbalkegbegebaaebaaaaac.......',
      '.....ihjjabebaageaejafbafjaaab.....',
      '....ikkfgbaeaaeggafegajbabbgeab....',
      '...baaaaebaeaaegmmgggbaebaebgffc...',
      '...fbeeaaaaeaaenoonjejamjba........',
      '...ilfbgejbeeagnooomhmompbg........',
      '...ikkkegjjngcabnmoqmmqmpjb........',
      '....fbjegemommoardnjqmsssfg........',
      '...ikkcbgenoohoor..tfqss..f........',
      '..ikklkkebnoorooooqaqqe............',
      '..iklkkkklcbbrooooqqqqb............',
      '..ilkkkklkkkkjroooqqqm.............',
      '.ilkkkklkkhjemoroqqqrm.............',
      '.ikkkklggnuuvuuuwwwwuumf...........',
      '.ikkklkcxxxvuvyyyuwyyvvxc..........',
      'ikkklkkbvvvxvuuyyyywyxvxm..........',
      'ikklkkkzxxvvvvvxxxxxxxvxb..........',
      'iklkkkmooqqAuuuuuuuuuu.f...........',
      'klkkkkjwwqqnuuuuuyuuuuym...........',
      'lkkkklmowqmjuuuuuuyyyuzub..........',
      'lkkklnoqwmkkbgAuuuuuuucyh..........',
      'ikklkmqqfkkklibyyuuuueyyBf.........',
      'iklkkhuufkkklinuuuuuuhuuBn.........',
      'ilkkbBCCfkklljDCCEEEECeBBqb........',
      'ilkkgoqqqflkljDCDDCDFDnooqe........',
      '.ikkeqqoFqfkmDCDDDCDFDDAoqb........',
      '.ikleqqoFnhzCDDDDDCDFDDnqqg........',
      '.ilkkemqqhknDDDDDDCCFDDCnb.........',
      '.ikkkklbhknCDDDDCCFFFDDDh..........',
      '.ikkklkkkmnCDDDCDbnDCDDDm..........',
      '.ikklkkkmCFCDDCDn.mCDCDDFz.........',
      'ikklkkkACFFCCCCn..gFFDCCFCc........',
      'iklkkkkACFFCCFFf..jBFFFFFCe........',
      'illlkklACFFFFFCz..jFCFFFCFb........',
      'iliiklkAFFFFFCFz...zFCCCFc.........',
      '.i.ilkllbGpppHm.....zpHnm..........',
      '...illiigGpGjb......bpHz...........',
      '....ii..bGpGf.......epm............',
      '........hppc........eHz............',
      '.......hoof.........gpHzf..........',
      '.......Apa..........bpHHHc.........',
      '......mpGf.........................'
    ]
  },
  goku_nino: {
    palette: {a: '#7d7a85', b: '#afb3b8', c: '#201d1f', d: '#302f32', e: '#000000', f: '#000103', g: '#020101', h: '#100c12', i: '#0a0102', j: '#8a4c37', k: '#ad6d57', l: '#7f1f17', m: '#5e3429', n: '#170301', o: '#2b0905', p: '#010212', q: '#f5b892', r: '#4a506d', s: '#d28f71', t: '#4f1f16', u: '#0f122c', v: '#020522', w: '#050f3d', x: '#b02f24', y: '#192b70', z: '#111c52', A: '#020309', B: '#4459ac'},
    grid: [
      '............................bcfc.............',
      '...........................bhdfb.............',
      '........................barcdAf..............',
      '........................f.fdcfa...bbbbbbbb...',
      '........................e.Adff...bfAAAAAAf...',
      '........................eahcff.bAAddccddcffb.',
      '........................efdffgbfhdddfeffff...',
      '........................ffdfgffAddffeeefc....',
      '........................Achfgffdcffgggef.....',
      '......................ffdcfeggfdfgggggg......',
      '.....................fcdfffeeeegeeeeeg.......',
      '....................Achffggeeeegggggge.......',
      '...................fdcgggggfgggeeeggfff......',
      '.................f.fdggggfAffggfeeeggAffff...',
      '...........ffffffAAcfefggfdffggdfeegcddddAAf.',
      '............fffddddefffegghdiggfdAeeefffefcff',
      '..............fffffeffdenkgcckigidfeeggggffff',
      '...............ggggggfdgssagisknikgeeefgA....',
      '...........AffhddggggfAisiegiqsjnjieege......',
      '.........ddffccggggfgfdonjhhisqsriheg........',
      '..........bfAAAggeefiinkjsa.giqqcimgggf......',
      '.........rm...Affeegskosqs...nmkh.dgeffh.....',
      '........btxj....feegsjkkqs...jqqi.ggf........',
      '........nlxxm....efisjssqsa.qqqqk.g..........',
      '.........nlxxmbffffgismkskssqqqkqsi..........',
      '..........olxxc....fgggisqqqqqqqqkd..........',
      '...........ollxt......fgmksqqksqsi...........',
      '............olllno......bmksqqqkr............',
      '.............ntosln..ffphksmongf.............',
      '..............nlxjjpphazBrqkskpuvv...........',
      '...............nllhzBBzarBrkjqkvBBw..........',
      '...iiiid........iitszBBzarBrqqqqyBBv.........',
      '..ojjjjjin.......isqszBBrarBrqkqyBzA.........',
      '.ojjjjjjjmi......nsqsjBBBwayBrsaBBve.........',
      'imjjmtttjjmg.....tqqsszBBBzarBByBBpki........',
      'gttmiiiitjji....ikqqqspzyBBzaywBBBBkn........',
      '.iih....otjmg...nqqqqmpyBBBBrcazBBBhj........',
      '.........ijtg..ikqqqqAyyBBBByauazBBhsi.......',
      '.........ijji..ikqqqkAyyyBBBByBuazyhsi.......',
      '.........ctji..oqqqsipwwyyyyzyzruawhssg......',
      '..........nmi.ijqqqqg.fpppppAAAApvuhssi......',
      '..........nttditllqki.fabb..bdb.r..ikto......',
      '..........ottinlxxli..pvvpppfbbrbppgtxlo.....',
      '...........ittnlxxxi.pyyBzyyAbzvabzpmlln.....',
      '...........ntmnotljn.vyyByBBp.zva.vyiljo.....',
      '............imisqqqkfzyBBBBrr.vyp.pygqkqh....',
      '.............iiqqqqqozBBBBBv..vyp..yisjqi....',
      '..............gsqqqoayBBBBBv..vyp..yitqsg....',
      '...............dssqkzyBBBBBvbbvyp.vrijjd.....',
      '................gcsvyBBBBBBBvpvyvvBBilob.....',
      '..................pyyBBBBBBBrwyyBBBBitltd....',
      '..................pyyBBBBBBywyyBBBBBAnlxor...',
      '..................pyyBBBBByzvyyyBBBBA.nli....',
      '.................pyByyBBByyvvyByyBByp..i.....',
      '.................vzyByyyyyyvzzBBByyyA........',
      '................pywyBBBByywAyyzyBByyp........',
      '................pyyyBByyyyv.pyByyBByp........',
      '................pyzyzzzyyzp.pyyBByyyA........',
      '................pyyyBBBByzp.pzzzBByv.........',
      '.................puzwyryyr...pApppp..........',
      '..................fpAAppc.....Awzyyp.........',
      '..................pyyrA.......f....BvA.......',
      '.................Ab...A.......Awzzzzyvp......',
      '................uwyyyzp.......uaaaaaBBBA.....',
      '...............bwyyyyzA........AApppfAph.....',
      '...............bvyBBrp.......................',
      '.................ffff........................'
    ]
  },
  goku: {
    palette: {a: '#2f3139', b: '#02041a', c: '#020703', d: '#010103', e: '#01030d', f: '#030101', g: '#020207', h: '#000200', i: '#f3c9a8', j: '#080101', k: '#b7312b', l: '#5a6ea9', m: '#0a010c', n: '#0f0102', o: '#cb8055', p: '#fb6535', q: '#ef6845', r: '#453c60', s: '#702e41', t: '#1d0103'},
    grid: [
      '.................agbb........',
      '..............lbada..........',
      '..............eadd...........',
      '.............eahdb...........',
      '............gaadd..cdddhe....',
      '............eahde.eaaaaaab...',
      '...........caahhdaaaaddgdae..',
      '...........daahhhaadhhgaabab.',
      '...........gaahhfaddfdaeb....',
      '.........dhhdhhdhhhhhab......',
      '.eg.....ehhhhhhddddheh.......',
      '..efga..dhgdhdgaadgaaaaab....',
      '...cffagdgaahdadfaegaefaaag..',
      '....ehgadaadhhaedhafgagghdag.',
      'gaaaadgadaadhjjhhhgadgadgheeb',
      'egddaaaadaadnoonfdfajfga.....',
      '..eghdfgddahnooojcjojdgh.....',
      '....dhffnhbagnjoijjijefg.....',
      '.egfdhdjojjoaslnfijie.eh.....',
      '...bghdnoocoos..reie...e.....',
      '.....dgnoosooooiaiid.........',
      '.......bggsooooiiiig.........',
      '..........fsoooiiij..........',
      '.......cfdjosoiiisj..........',
      '....hhnkkpooosssskkje........',
      '....blllqkpiiiosiiqqlb.......',
      '....grrrlpkkiiiisilplj.......',
      '....mllrrppqlllllllqlg.......',
      '...jooiitppkqrrrrrr.e........',
      '...fssiinkkpkqlrrrrlj........',
      '...josijfkkpkkplllqmog.......',
      '..noisj..ghtkkpppppbic.......',
      '..jiie.....gllkkkkdiire......',
      '..clle.....nrrrrrrcrrrn......',
      '.grlle....fpkkllllkdrrig.....',
      '.hoiiie...fpkpqkqsqnooid.....',
      '.diiosie.jqkpppkpspqtoig.....',
      '.diiosncmkpppppkpsppniih.....',
      '..djiic.nppppppkksppkng......',
      '....gc.nkpppqkksssppqc.......',
      '......jnkpppkqgnqkpppj.......',
      '.....jkskppkqn.jkqkppsm......',
      '....tksskkkkn..hsspkkskb.....',
      '....tksskksse..frssssskd.....',
      '....tkssssskm..fsksssksg.....',
      '....tsssssksm...mskkksb......',
      '.....glkkksj.....mrsnj.......',
      '.....hlklfg......grsm........',
      '.....glkle.......drj.........',
      '.....ckrb........dsm.........',
      '....cooe.........hrsme.......',
      '....tka..........grsssb......',
      '...jkle......................'
    ]
  },
  goku_ssj: {
    palette: {a: '#020218', b: '#0c0104', c: '#f6ae0c', d: '#fdf8e7', e: '#ca8260', f: '#d13c26', g: '#a5501c', h: '#edb127', i: '#703338', j: '#9e4e2e', k: '#030302', l: '#2e2c98', m: '#3e2a83', n: '#170101', o: '#5a70db', p: '#f6dcc7', q: '#978dce', r: '#f98a2b', s: '#77043f', t: '#03020d'},
    grid: [
      '......a...................',
      '......t.......t...........',
      '.....tdk......kt..........',
      '.....nddkka...kdk.........',
      '....khdddddkk.tddb...a....',
      '....bddddddddbkddcb..k....',
      '...kcdjddhdddhjdddt.tda...',
      't..tcdgcddccddjdddhbndk...',
      'kt.kcpjdhpdhccgdcdcggdda..',
      'kdknccgddhddcccdcdcgcddk..',
      'kddjggjdddhdddhdcdcjcddk..',
      'tdddhjgcdddhddcccdcgcdht..',
      'kdhddhgphdddcdcccdccchk...',
      '.tdhddhcphddcggccgjjggbt..',
      '..tphddccpccjddhgdddjcccb.',
      '..bgdcpccjjjddddgchddghcct',
      'abnggcccjddjddchccphddjjhk',
      'bcccgjgjdddgddceejjdcdkkkt',
      '.bhhcchjdchegphpppetddt..a',
      '..tkggjgdheejjdppppktdk...',
      '...nccnejdeeiqjepppa.at...',
      '.kkcccbeejeeiddjgpt...a...',
      '...kkkbeeieeeedqdpt.......',
      '......ttkieeeeppppa.......',
      '.........bieeepppk........',
      '......tkkkeiepppik........',
      '...kkbffreeeiiiiffbt......',
      '...kooorfrpppeipprrok.....',
      '...tlllorffppppidorok.....',
      '...aoollrrroooooooeot.....',
      '..keeppkrrfrmllllldt......',
      '..tiippbffrfrolllmqk......',
      '..beipkkffrffeooorbea.....',
      '.nepia..kkkffrrrrrbpt.....',
      '.kppk.....t..ffffkpplt....',
      '.t.qt.....tmlllllklmlk....',
      'am.qk....krfgqqqqfammpt...',
      'kepppt...krfrrfrsrneepk...',
      'bppeipk.nrfrrrfrsrrbepk...',
      'kppeikttfrrrrrfrsrrnppt...',
      '.ttppaqnrrrrrrffsrrfka....',
      '...kt.kfrrrrffsssrrrk.....',
      '.....kbfrrrfrbnrfrrrk.....',
      '....nfsfrrfrt.nfrfrrsn....',
      '...tfssffffn..bssrffsfb...',
      '...kfssffsst..kssssssfb...',
      '...kfsssssfb..tsfsssfsa...',
      '...tsfsssfst...tsfffst....',
      '....tofffsa.....klskt.....',
      '....kofoka......klsk......',
      '....bofoa.......kma.......',
      '....kfmk........kgk.......',
      '...thha.........tmstt.....',
      '...nfb..........tlmsst....',
      '..bfok....................'
    ]
  },
  goku_ssj2: {
    palette: {a: '#03041a', b: '#fcf7ea', c: '#010304', d: '#0f0201', e: '#fef8cd', f: '#a65019', g: '#080203', h: '#9e4f2d', i: '#120109', j: '#723336', k: '#d23c24', l: '#5d71d4', m: '#02030d', n: '#f5d8c3', o: '#322b91', p: '#cb8162', q: '#f98a2a', r: '#eeb129', s: '#76053b', t: '#9a8ad8'},
    grid: [
      '.....m.....................',
      '.....ga......a.............',
      '.....cbcm....mm............',
      '.....dbbbccm.cba...........',
      '....ihbb.bbbggbbm..........',
      '..a.chbbb.reehbbbmi.i.tm...',
      '..mddfbbbb...fbbbhf.a.cg...',
      '..d.gfrbbbbb.he.bbf.ddbc...',
      'a.d..he.bbhbbfe.bbfhfrbg...',
      'ccd..hbbrefrer..bbrhfbbc...',
      'cbd..fbbb.hbre..bb.f.bbc...',
      'cbbh.frbbbhbbre.bbrh.erc...',
      'abbbhhe.bbhbbb..bfhh.rc....',
      'mbrebfrerbfrbberhebhhfdi...',
      '.ce.bb..bhhhbbbf..rbf......',
      '..iere..rbnh.ebf.bb.bf...a.',
      'ggdhb.rfbbrf.....bbbbbgcmca',
      'i.rfffhhbb.ppnnnphhcabbc...',
      '........hb.ppnnnnnpc.cbc...',
      '..ihfhhgrfnphhnnnnnc..am...',
      '...gffgpgphpjthpnnna...a...',
      '.mdrrrdppjppjbbhhng........',
      '...mcgdppjppppblbnc........',
      '.......cdjppppnnnnm........',
      '.........cjpppnnnm.........',
      '......idddpjpnnnjd.........',
      '...cmikkqpppjjjjkkdc.......',
      '...clllqkqnnnpjnnqqlm......',
      '...cooolqkknnnnjnlqlg......',
      '...dllooqqplllllllplo......',
      '..gppnngqqkqoooooobi.......',
      '..ijjnnckkqkqlooootm.......',
      '..dpjnmikkqkkqlllqdpcb.....',
      '.dpnjm..ccikkqqqqqdnabb....',
      '.cnnc.....m..kkkkcnnoc.....',
      '.a.tm.....aoooooocooom.....',
      'mo..c....iqkkttttkioona....',
      'dpnnnm...gqkqqkqsqippna....',
      'gnnpjnc.dqkqqqkqsqqcpnm....',
      'annpjcmgkqqqqqkqsqqinna....',
      '.mcnnm.dqqqqqqkksqqkga.....',
      '...mmtdkqqqqkksssqqqm......',
      '.....cdkqqqkqidqkqqqi......',
      '....ikskqqkqm.gkqkqqsm.....',
      '...cksskkkkc..mssqkkskc....',
      '...cksskkssm..dsssssskm....',
      '...ckssssshc..gsksssksa....',
      '...msksssksa...gskkksa.....',
      '....clkkksi.....mosim......',
      '....glklgc......aosc.......',
      '....mlklc.......com........',
      '....dkom........dhg........',
      '...mrra.........moscm......',
      '...ikg..........aoossa.....',
      '..iklg.....................'
    ]
  },
  goku_ssj3: {
    palette: {a: '#020306', b: '#fef9e6', c: '#f9f2f5', d: '#d48457', e: '#fef9ef', f: '#f4b008', g: '#6d77d9', h: '#040314', i: '#100102', j: '#fcac05', k: '#eeb015', l: '#fb8f23', m: '#f6d7c6', n: '#fef7db', o: '#fef8c7', p: '#eab12f', q: '#1a0102', r: '#b74625', s: '#070203', t: '#5f1b59'},
    grid: [
      '...............aa.....a...........',
      '...............aea....ai..........',
      '...............abeih..sfq.........',
      '.........haaaasibbfbaaskjs...a....',
      '..........aceebkcbekcbenkka..h....',
      '...........abbbfrncbfknrbbksieh...',
      '...........ifoofrpoobpfrobbprbi...',
      '.......ahassffjjrnjkeofrknebrnkh..',
      '.....hheebebbbekrbbbffjrepenreea.h',
      '.......aebekffjjrnkbbnkrebknrcbish',
      '........ipnnnkjfkropbnbrebbprbefps',
      '...aassaskjrrrrrrrknfebrreenreejph',
      '....hceeenkkrbceebofnkrbernejbnka.',
      '.....aebeebjfrnnbkjkjprebofefojpa.',
      '......spopkjjkrfbobofdcnnffojfkh..',
      '......aikbeenfjjjfjjddbeffjfjka...',
      '....ahbcbrrrrrkenofjddbjkmmmmds...',
      '...sbnennfjkkrbbpirkddjptmmdmma...',
      '..abepkfpoknrbopbsdrddptgtmmdmh...',
      '.heebbnkbkbbrnfbeiddrddtcctmda....',
      'haaairroknborbjrkqddtddddcgcma....',
      '....ikrpeenfrnrjjpastddddmmmmh....',
      '...qffrneojprrfffkppstdddmmma.....',
      '..ifjjrenjfnrjfjkissidtdmmmta.....',
      'aqfjfjrbrkjenkshirrldddttttrrqh...',
      'fjjjrkrrnjkenkaggglrlmmmdtmmllgh..',
      'hpkprkrojknbfpstttglrrmmmctcgdga..',
      '.aairknkjkenkesggttlldgggggggdga..',
      '...ikofjknekcsddmmallrlttttttca...',
      '..skbkfjrokeesttmmsrrlrlgttttga...',
      '..aeoffrnpnbcidtmsirrlrrlggglids..',
      '.aeefjrncbrrsdmtirrisqrrlllllsma..',
      '.abbjrrrrrrrsmmsjkjjrhg.rrrrimmta.',
      '.hcejjknkrrrh..arrffrittttttsttts.',
      '.hbbfkopaikstggsrqrrslrrg.ggrhttma',
      '..aefoka.ifidmmma.srslrllrltlqddms',
      '..ankns..ajammdtma.ilrlllrltllsdmh',
      '...aba...sfqmmdtasirlllllrltllimmh',
      '...aeh...ajkaammagsllllllrrtllrah.',
      '....a....sjka.aa.irllllrrtttllla..',
      '....a....afh....aqrlllrlislrlllh..',
      '.........ah....qrtrllrlh.qrlrllti.',
      '.........h....arttrrrrs..httlrrtra',
      '..............arttrrtts..attttttrh',
      '..............srtttttrs..htrtttrta',
      '..............atrtttrta...atrrrta.',
      '...............agrrrth.....httsh..',
      '...............sgrgah......stta...',
      '...............agrga.......hth....',
      '...............arth........srs....',
      '..............apph.........stthh..',
      '..............ira..........atttth.',
      '.............srga.................'
    ]
  },
  gohan: {
    palette: {a: '#381451', b: '#2c1a3a', c: '#140621', d: '#0e041a', e: '#4e3652', f: '#25162f', g: '#1d0f26', h: '#412d40', i: '#6d332c', j: '#f5e6e0', k: '#9e6a5f', l: '#ca907d', m: '#200309', n: '#bc816a', o: '#bb9f99', p: '#fcddbd', q: '#dbc0af', r: '#0b0111', s: '#6076af', t: '#a57d80', u: '#48419b', v: '#783ca3', w: '#4c1c78', x: '#1f0436', y: '#3b1465', z: '#58208c', A: '#83487e', B: '#38161c'},
    grid: [
      '................................bbhfgh..........',
      '..............................ehbbfgh...........',
      '.............................ehfffcf............',
      '.............................hbfcgfe............',
      '............................hfgdff..............',
      '..........................efbbdfr...............',
      '......................fffffffdcdd.fffh..........',
      '.....................efffgcddddccgfffffh........',
      '.................r..hfbcddddddcdfbbbbfffgf......',
      '.................d.fffcccddddddddcccccdcbfbf....',
      '.................rcbfbfgdddddddcdrdddddcrdrfg...',
      '...............gdddcffffgddddddddddcddcrrd......',
      '.............efd.gbdccccdrdddddddddcddb.ee......',
      '.............ehhhrggcdddcddrddddggddcgfe........',
      '...............hfgdgdgfgcggcdddcgfccgfffe.......',
      '...............gdcdcgfhbgbbggffgfgbggfbfg.......',
      '..............hcdcddfbfcbbgfm..mgcbbcgfbf.......',
      '.............hgccrddgffggfcm....mfffgccffr......',
      '.............hgccdddrgfehgf......mgfehrdfr......',
      '..............eggdcmomgeBmcgg.kkk.mfe.ergr......',
      '................grro..m.k.gfgmtkkkmfe...rr......',
      '.................rmj..mknkhdffmtikmch....r......',
      '..............hcxcmopklnqoojjrbmkkmdh...........',
      '............hgayvvacoplqppjjjjr.k.me............',
      '...........ee..vzvvabBkqpqoojjBtpkBe............',
      '............AtAzvzvza..lqpqqjpoqpnie............',
      '...........koltAvzzvAt.klqppoqpql..e............',
      '.........etnllnkAvwvAlk.klqqnopk...he...........',
      '.........btllnnnAvwv.nnnnkknqqtae..Be...........',
      '.........BtlllkkAwyAl.lnln..teazak.Bh...hjjh.e..',
      '.....ggrmtppqn.kawyAlllnk.i.oAyw.km....hjjkpjth.',
      '...hBjptmjplnlkbywyAtlnl..nlAvwyk.iBh..Bp.ppppe.',
      '.e.ojkppkonnllAaywyw.kllnntAAwwxknpthrBkkni.njh.',
      'eAopppnjsstk.BfayywywAeAttA.wwamlppottkkpppn.lb.',
      'e.llppnosqq...xaayywyzwwyyaayxcknnntu.oppppp.nB.',
      'h.nnklppjoqshrauuyyyyyyyyywwx.r.knlsstnklpnllkme',
      'h.nknnlptjssyrxuuuuuyyyyuuuux..gmk...tnkkllllB..',
      'helnnnnlqjsuydxyuussssusuuuyx..e.hfw..nnnnlth...',
      '.h.nnlnlqjsyafxyuuuussssuzzwxee..hhyw..tnl.ih...',
      '....nlnntoeahbawzzwuusuuuzzzwwy.e..hyee..kBB....',
      '...Bkkktthbebawzvvzwywyywwzvvvzwa...hfggBB......',
      '....mmmmdg.byzvvvvvzywywywzzzvvvzwa.............',
      '..........cawzvvvvwwzwyyywzvvvvvvvvy............',
      '.........azvvvvvvzzzwyayyyyyyzwwvvvvah..........',
      '........xvvvvvvvzvzwyyaaywwwzvvvvvvvwxb.........',
      '.......xvvvvvvzzvwzyxcrdcxywwzwzzvvzyyac........',
      '......cAyvvvvvvvwwxc.....exxywzyywwyyyab........',
      '......xvwzvvzzwyax..........xxwwyyyyayybc.......',
      '.....fazzzzzzzz.xe...........cawwyyayyyabg......',
      '....Bewzzzzzzvvwx............caayyaayyyabr......',
      '....mAwwzzwzvvzwc............hxaayaayayabfh.....',
      '....m.Awzzzzvzyab.............cayayyyyaaahc.....',
      '..e.mi.hewwzwwax..............fbaaaaaaabhhm.....',
      '..emBii..awyyaf................gfabaaabhBimm....',
      '.hBi..i.iihccb..................ddhe...ii..im...',
      'hBi...i....Bh.....................rmBiiii.kkim..',
      'hh.......ime.......................BBi......im..'
    ]
  },
  gohan_ssj: {
    palette: {a: '#020218', b: '#03020d', c: '#fdf8e7', d: '#030302', e: '#170101', f: '#edb127', g: '#0c0104', h: '#f6ae0c', i: '#9e4e2e', j: '#a5501c', k: '#f6dcc7', l: '#ca8260', m: '#703338', n: '#978dce', o: '#633f9e', p: '#8a5cc4', q: '#d6333a', r: '#8e1f2a', s: '#4e2c14', t: '#7c4a22'},
    grid: [
      '......a...................',
      '......b.......b...........',
      '.....bcd......db..........',
      '.....eccdda...dcd.........',
      '....dfcccccdd.bccg...a....',
      '....gccccccccgdcchg..d....',
      '...dhciccfcccficccb.bca...',
      'b..bhcjhcchhccicccfgecd...',
      'db.dhkicfkcfhhjchchjjcca..',
      'dcdehhjccfcchhhchchjhccd..',
      'dccijjicccfcccfchchihccd..',
      'bcccfijhcccfcchhhchjhcfb..',
      'dcfccfjkfccchchhhchhhfd...',
      '.bcfccfhkfcchjjhhjiijjgb..',
      '..bkfcchhkhhiccfjcccihhhg.',
      '..gjchkhhiiiccccjhfccjfhhb',
      'agejjhhhiccicchfhhkfcciifd',
      'ghhhjijicccjcchlliichcdddb',
      '.gffhhfichfljkfkkklbccb..a',
      '..bdjjijcflliickkkkdbcd...',
      '...ehhelicllmnilkkka.ab...',
      '.ddhhhgllillmccijkb...a...',
      '...dddgllmllllcnckb.......',
      '......bbdmllllkkkka.......',
      '.........golllkkkd........',
      '......bdddlolkkkod........',
      '...ddgoopllloooooogb......',
      '...dqqqpopkkklokkpppd.....',
      '...brrrppookkkkocpppd.....',
      '...aqqropppppppppplpb.....',
      '..dllkkdppopoooooocb......',
      '..brrkkgoopoppoooopd......',
      '..glrkddoopoolqqqpgla.....',
      '.elkra..dddoopppppgkb.....',
      '.dkkd.....b..oooodkkrb....',
      '.b.qb.....brrrrrrdrrrd....',
      'ar.qd....dpojqqqqoarrkb...',
      'dlkkkb...dpoppoprpellkd...',
      'gkklrkd.epopppoprppglkd...',
      'dkklrdbbopppppoprppekkb...',
      '.bbkkaqeppppppoorppoda....',
      '...db.doppppoorrrpppd.....',
      '.....dgopppopgepopppd.....',
      '....eoroppopb.eopoppre....',
      '...borrooooe..grrpoorog...',
      '...dorroorrb..drrrrrrog...',
      '...dosssssog..bsosssosa...',
      '...bsosssosb...bsooosb....',
      '....btooosa.....dssdb.....',
      '....dtotda......dssd......',
      '....gtota.......dsa.......',
      '....dosd........djd.......',
      '...bffa.........bssbb.....',
      '...eog..........bssssb....',
      '..gotd....................'
    ]
  },
  krilin: {
    palette: {a: '#3a4389', b: '#f5d5b3', c: '#ebc39e', d: '#fce3bc', e: '#cfa88d', f: '#ae8e83', g: '#3c222c', h: '#8a7a95', i: '#aa4c3b', j: '#aa735f', k: '#fceddc', l: '#c5886b', m: '#350709', n: '#d9c0b6', o: '#8f5f53', p: '#15030e', q: '#21152a', r: '#433347', s: '#e57130', t: '#ca4c13', u: '#1f275d', v: '#f67c29', w: '#c06040', x: '#c74b2a', y: '#5b72c4', z: '#952823', A: '#7c3237', B: '#5e2a2b'},
    grid: [
      '.......................r..ggr.................',
      '.....................r.fkkkffqg...............',
      '.....................nkddddddderr.............',
      '..................rhnbdkkdbdddbe..............',
      '.................ghnddkkkddddddde.g...........',
      '.................qnddkkkdddddddbknfg..........',
      '................gfbdddddddddddddddnr..........',
      '................gfecddddddddddddddnhr.........',
      '................qflcdddddddddddeccenp.........',
      '................pflecddddddddddccbcbp.........',
      '................pfjlecbddddddddbcbcbp.........',
      '................pollllccdddddddebcenp.........',
      '................p.llllllbbddddddddbfp.........',
      '.................pocdclllfkkkddeef.fp.........',
      '.................pnf.jbllpqqpfbddbfq..........',
      '................ppbfojljmppqqpjll.p...........',
      '..............gmjmfbejllk.ffpgpoj.q...........',
      '............gmlillmoeceddjddfpfbbfq...........',
      '...........rfwsstvijoolddbjddmkdbfg...........',
      '.........rgolwtvtvwwjjoldbcbdeddejBg..........',
      '........rr.ccwxsssswwllljdbdjebcjiAp..........',
      '........gBfbdljwvtvswjlljeedeeelwiAp..........',
      '.......r.oebcjlivtvvsllllojcccwwwiBg...hh.....',
      '.......g.eclloixvvsvvccelo.flstxwAq...rkn.....',
      '....rgppBjffdlzsstvvsslbbAjbwsxxjoq..qkcfdf...',
      '..qqfkde..hkljixxxtxssslllwilwilj.m..pkodddf..',
      '.qfkdlbdnh.h.mwzziizzxxsiwllwmojcn.ppjljolbd.r',
      '.qkbddjjo.ayyqAwzjmelzxxlliimmjcnha.jodddolc.r',
      '.qfddflcdnhyaqAzjA.gojzzzzwzAmfl.aagfdbjddjlBr',
      '.qfllobbeenh.ppqqAA.AiwwzAAAAmoj.a.jfjddllljgg',
      '.peljlbecbbfq.puua...AAAAr.gp.p..uajloldjllgr.',
      '.pfljlelecllp.p.r.yyyahhyaurp..qraurjAjllogr..',
      '.rgjllllllljp.miio.aaayaya.iBg.ruuug.ojeBgr...',
      '..p.jjjlljorrgBsvtio..aaaAixiABrruuqqr..gr....',
      '..gp..hooo.gBmivvtsxAraygixttxzBBgqgqggg......',
      '...qquuuqqq.mwtvvvvtiruygixsvvvtzBg...........',
      '....pppqr..mxvvvvvvxoaayuAitvvvvvsim..........',
      '.........Bmxvvvvvtswhyayu.ivsvvvvvsip.........',
      '.......gmAstvvvvvvtAyyayuaoxtvvvvvvwm.........',
      '.....pmAiistvvvvtsw.yyyyuaAixtsvvvswjp........',
      '....pBiwxtstttttvwm.yyyuuaamzxxzztxzAm........',
      '...pAixxxxstxxxxzmpyyyyuuaapAzziizzzzAp.......',
      '...pixxxxxxsxxxlmpayyyyquaapmizziiizzABm......',
      '...pAxxxxxtxttsm.pyyyyapqqq.pAizzzzzzAAp......',
      '...pBzxxxxtssswm.ruuuuurrrr.pAzzzzzzzzAp......',
      '...p.AzxxxtttwAp..rrrrr.....pAzzzzzzzzAp......',
      '...poAAzzxxxwiBg............gBAzzzzzAABp......',
      '...p.oBBAAiioBm..............mBABAAABB.gr.....',
      '..pphhh.BBBBpp................mmBBBBBrhhp.....',
      '.pqrrqhh.ppp...................qpg..hhhpqp....',
      'pqqqrrgqppp......................gpppqqrrgp...',
      'ppqqqqqqqg.........................pppqqqqpr..'
    ]
  },
  vegeta: {
    palette: {a: '#42394f', b: '#211433', c: '#1b0d23', d: '#160409', e: '#291b34', f: '#2a2545', g: '#443635', h: '#dbb57d', i: '#0e49b4', j: '#f7fbf8', k: '#f5dbb8', l: '#04083a', m: '#bb8f7e', n: '#a5b0bf', o: '#0c155c', p: '#1c3f94', q: '#c7d9f3', r: '#936d62', s: '#c3ccce', t: '#0b031d', u: '#081d79', v: '#2a376e', w: '#2981f6', x: '#2267d3', y: '#3d7fe7', z: '#7e889a', A: '#e1e7ec', B: '#d1dadb'},
    grid: [
      '...............................a...........................',
      '...............................c...........................',
      '..............................ec...........................',
      '.............................ttb...........................',
      '...........................acetb...........................',
      '.......................c....ebtet..........................',
      '.......................ccg..bftbt.b........................',
      '.....................c.tcttbfbbeb.eb..ee...................',
      '.....................aftttcbbbbbccbbbaade..................',
      '.....................aabttcebbcbetcbbfccc..................',
      '.....................eabbccebbccctcbbbbbcf.................',
      '.....................bffbccbbbfcctbcbeebct.................',
      '.....................bbffbtcbbffcttbbcfeeca................',
      '.....................becffbtcbefebtbebbaaet................',
      '...................d.tbeebbbtbebabctbbbfaaft...............',
      '...................tttetceecttbebebtbbefaabt...............',
      '..................btttbbcbbbttbbcbebbbbefabe...............',
      '..................abttebbccbttbbbtbeccebebbbt..............',
      '..................aabttbbectctebeetbeccebebet..............',
      '..................baaettbctcttebteccccdcebeed..............',
      '..................ceabetctcccttecmmkkm.dfbbcrc.............',
      '..................ceeftbctcebcddmkkkkkmrefbczd.............',
      '..................acebbccccbeedrmkkkkkkhrebcmd.............',
      '...................ecebcccbcbc.mmhhkkkkkh.egmd.............',
      '..................g.cebbttccccmmmrmmmkkkkm.rmd.............',
      '..................ctebetttcccdrmmrmeerskkkkm.c.............',
      '...................tcbbectcddddrrmdebb.kkmkmde.............',
      '.................tttttbceccgkmdrmmcbfbcgmkrmct.......vv....',
      '................uipttttttd.krgddrmddtcebemmrdd.......qjv...',
      '..............vuiiplttttttzhrrmmmmdsB.beddrrd....vvzqBBjf..',
      '.............auxwwypllttttghkrmmmkjjjAzerrmrd...fnnnjjsBql.',
      '............fouiwwwypoltdddcmkkrkkrmAjm.mkkmd..bnnsjjjjjAl.',
      '..........oouuouiwwwiuulzh.dcddrkkkkkkkkkkkjtctqsnznsAjjjsf',
      '.........oupuuuuuiiiiuoonkrbf..dmkkkhkkkkkmfpxlsnnBAAjjjBql',
      '........oviiuuuuuuiiuuovsjszo.rrrmkkkhhmrr.uyyu.nsBBBjjABql',
      '.......fopiupuuuoopuuuozBAAnuv.mmrmhkkhmrfopxxionsBsBAABsAl',
      '......alzzxuuuoooououozAABAquuv....rzskknoiiiiplnBsnBssBBBc',
      '......faAqzvooouoloovvqAAAAsvuppupuuozjjAppuiiuuzBnnssBBBBt',
      '....abqjjBsnvvppotllAqzAjjjjspyyiupypnABqoupiwyiozsnzzBBAzc',
      '..gttzjjjjsjAzppot.tjszBjjjjjqupplvpqjABAouuiwwyyzznBBBBAt.',
      '.e.AjjsBzjzBjqzll...dAAzssAjjjjjqzqjjAAstouuiiwyynBszBBAzd.',
      'czAjjjjsjzAznAzb....ttqABBBBBBBBBzBBBjzttloiuiiiqAABzBBzt..',
      'ezBjjjBjjjzzssze....loovnBnzrgg..ggzede...lpiuiiqAAjsszAd..',
      'fzsss.jjjsszsn.e...topuoa...rrrr..dta.....tupiuiqAAjjsBAd..',
      'fzBszBjjBjjBz.f....lpiupoof....blt.........lupupqAjAsszt...',
      'ezsBsBBzjjjsAze...ouiyyiippp.ppppll........touupnAABszAd...',
      'a..BBsBsABAjA.g..ouiixwxxwiiiiiiipvobeg....aluuu.nsssnag...',
      '...zBsBsBsBBz.g.vuxxxxwwwwwxiiiixxxipvffa...aluoupzzz.t....',
      '..aazzsBBsBz.aavuxwwwwwwwxwxiipixwwwyxpvfag..boououooff....',
      '....ecnnnnng.afuiwwwwwwwwxxxpuiiixwwwwxxxul...booouoob.....',
      '......dctct..foiwwwiiwwwwyxpuuiiiiwwwxiiiyil...cboofb......',
      '.............fuywwiiwwwwyipuoouiiiiiwwxxwwypt...cttb.......',
      '.........ddtluiiiwiwwwwiotttlooopiiiiiiixyypl..............',
      '........djAxiiixwwwwwypl.....ttlloopuupiiiupl..............',
      '.......tAzpppiiiwwiyypl..........tlllouuuuupl..............',
      '......bzjviuiiiiiippol..........djbopiuuuuuvl..............',
      '......lzjvupiiiiuuol...........cAllpipuuoo.l...............',
      '......lzqquiiiuuupt............tjlouuuuuupl................',
      '.....fzznqnpppppuo............c.Aluoouuovnt................',
      '.....znzznqnzzzzfa............dznzoouuvz.Ad................',
      '.....AAnnznsnzz.f.............tzzszzzzznnze................',
      '..g.BjjjAzzz.fce..............fzzzjAjAAABg.a...............',
      '.grkjjjjjAzzfa...............tzzzzsssBnzssdd...............',
      'erhhhhkjjjBb.................tAzzqqBsnnBjkhmd..............',
      'c.hhhhhhkjAea................tzAzzzzsAjjkhhhmd.............',
      '.egmhhhhhkd...................dzjAAAABAjhhhhhd.............',
      '................................a...a......................'
    ]
  },
  vegeta_ssj: {
    palette: {a: '#0a0a12', b: '#d8a020', c: '#fff6c0', d: '#f8e070', e: '#cb8055', f: '#2f3139', g: '#020207', h: '#0f0102', i: '#080101', j: '#f3c9a8', k: '#702e41', l: '#5a6ea9', m: '#030101', n: '#01030d', o: '#020703', p: '#453c60', q: '#010103', r: '#c8c8d4', s: '#f4f4f4', t: '#233f96', u: '#8a8aa0', v: '#02041a', w: '#e8c14a', x: '#3a5fc8', y: '#b08a20', z: '#0a010c', A: '#1d0103', B: '#b8b8c8', C: '#000200', D: '#152a66'},
    grid: [
      '..............aa.............',
      '.............abcaaa..........',
      '...........aaabcabca.........',
      '..........abddddddca.a.......',
      '........aaabddddbdcaaba......',
      '.......abdddddddbdddca.......',
      '.......abdddbdddbdddca.......',
      '.......abdddbdddbdddbaa......',
      '......abddddbdddbdddbdca.....',
      '.....abddbddbdddbdddbdba.....',
      '......abdbddbdddbdddbca......',
      '......abddbddbddbdddbca......',
      '......abddbddbddbddbddba.....',
      '.....abdddbddbddbddbddbba....',
      '.....abdddbddbddbddbdbba.....',
      '.....abddddbdbddbddbdba......',
      '......abdddbdbddbddbdbca.....',
      '......abdddbddddddddddca.....',
      '......abdddbbddddbbbddca.....',
      '......abddbaabddcaaabdba.....',
      '......abdba.aebdbaaeaba......',
      '.......abeefghibjiijia.......',
      '.......abeiefklhmjijn........',
      '.......aeeoeekaapnjn.........',
      '.......aeekeeeejfjjq.........',
      '........aakeeeejjjjg.........',
      '...........keeejjji..........',
      '..........aekejjjki..........',
      '.......rrs.atuuuurri.........',
      '....vwwwsrsxxxtuxxsswv.......',
      '....gyyywsrrxxxxuxwswi.......',
      '....zwwyyssswwwwwwwswg.......',
      '...ittxxAssrstttttt.n........',
      '...muuxxhrrsrsxttttxi........',
      '...ituximrrsrrsxxxsztg.......',
      '..hBxui..gCArrsssssvxo.......',
      '..ixxn.....gxxrrrrqxxBn......',
      '..ossn.....httttttottBh......',
      '.gBssn....mxttsssstqrBsg.....',
      '.CBsssn...mxtxxtxDxheBsq.....',
      '.qssBDsn.ixtxxxtxDxxABsg.....',
      '.qssBDhoztxxxxxtxDxxhssC.....',
      '..qisso.hxxxxxxttDxxthg......',
      '....go.htxxxxttDDDxxxo.......',
      '......ihtxxxtxghxtxxxi.......',
      '.....itDtxxtxh.itxtxxDz......',
      '....AtDDtttth..CDDxttDtv.....',
      '....AtDDttDDn..mrDDDDDtq.....',
      '....AtDDDDDtz..mDtDDDtDg.....',
      '....ADDDDDtDz...zDtttDv......',
      '.....gsrrrui.....zruhi.......',
      '.....Csrsmg......gruz........',
      '.....gsrsn.......qri.........',
      '.....orrv........quz.........',
      '....oeen.........Cruzn.......',
      '....Arf..........gruuuv......',
      '...irsn......................'
    ]
  },
  piccolo: {
    palette: {a: '#203922', b: '#90b576', c: '#a0dc34', d: '#33a72d', e: '#6ec13f', f: '#237733', g: '#423d4a', h: '#f0b7b9', i: '#d47274', j: '#92e252', k: '#bce668', l: '#53a81d', m: '#9b405c', n: '#a46348', o: '#612b8c', p: '#546eaa', q: '#441c77', r: '#150c18', s: '#478856', t: '#7c3ca9', u: '#744696', v: '#85b0ed', w: '#7235a0', x: '#3c1462', y: '#511a85', z: '#2c1344', A: '#833b2c', B: '#54282d'},
    grid: [
      '..................................gzzzzz...........................',
      '................................zaskkkkb.zzg.......................',
      '...............................gbkjccccckkb.gg.....................',
      '...............................sjjckkcccccckbsa....................',
      '..............................seljkkkkcccccccjsg...................',
      '............................g.ellckkkkccccccccjs...................',
      '............................g.jddjkkkkcccccccccbg..................',
      '..........................ggg.jddjckkcccccccccckg..................',
      '..........................zgfledlcccccccccccccccea.................',
      '...............xxqyxxx....zbllddlcccccccccccccccja.................',
      '..............zxotwqtuxxz.rejedddjcccccceljccccckaa................',
      '.............zxzzxytxtttyzrleejdddjccccleelcccccjek................',
      '............rqhhhhmxttywtyrelddjdddljkkjlljlcjlcjrfbsa.............',
      '..........zzhhhhhhhiytwyyyzeedddjddfdjccjeljljljlrrfssg............',
      '.........zhhhnnnnnihiqwyqqpseeffjjdddlecceljdjddjr.afgrrrg.........',
      '.......gBnninhnnnnniimtyqpsffddddjdddddleeejddddkr.ragasbsz........',
      '......gsbbnninnnnnnmmmtyxssfddddfdddddffdeelddfjkr..arajjbr........',
      '....g.secccnniiiiinn.moyqssssddffddeefbbsdeeeddjag..ggacckr........',
      '...gg.eccciiihiiiiin..qoq.gggssfsdecjfhhbsfeeddsa....aacckab.......',
      '...gfeeckiiiihiiiiin.gqoxgs..gsaffjcefbhhbafddfr.....gaejefjeg.....',
      '..asellechhnnhiiiii..z.aaejjjeeeafjclllkhbfddsrzg....gafjdfjjag....',
      '..abjjjllnhhhimmmmm.rrljccllldljkrljccccjeljjezqr.....gassfjclb....',
      '..rgbjjjcknnhhhiinAlkjccccjjjedesasjccccccccjhzyqz.rrrrasffjjcce...',
      '...aafdljkjlnnnninllllccccllejefsasljcccjjjjszqyyyrfjefafffddjjlebg',
      '....aasdddddjkkiibjcjcccccjjelbsasfddjclldfszqtqtwzbccjssssfdddejbg',
      '.....aasdddddllnmAljjccccclcjesasfsffdjjjbsxqtyttoreccjbfssfsffeesg',
      '......grrssddddnmAldddljcccleesassfffdff...qywttymmsecedffsffsddf.g',
      '.........rrasfdnn.ddddddljjlddsabsssjjs.uwowytuommmBflddfddsfsdejsa',
      '..........g.ararraadddffddlddfafsffdels.oowwyo.umimmarasfdddfdeje.B',
      '.............gggggaaaasfdddfagfsfsfs...wwooox...ihhinBrafdddfdjel..',
      '...................rgrsdddfazgggppoowowwoyxxz..ihhhhhnBB.ssdfdee.g.',
      '...................rogffffaxooqqowwyyyooqzrz...hihhhhin.....ssnn.g.',
      '...................zqpzgarxqyyqqqyyyyqqzzrz.g..ihhhhhi.sg.mmmmmmBg.',
      '..................grxppvvpqqqqxxqqqyxrrg...rrs..hhhhi..s...mmAmBg..',
      '.................gzxqzpvvvvvvppppvouz.......rsfg..mnns.AihhhhimBg..',
      '.................gzyyyxzpppvvvvvppoxz........rssff..s.nhhhhhhmB....',
      '................gxyyyqyyyyqqxxqqqxyyqrrrrz....rrsssffnihhhhhmr.....',
      '..............xzxyotwwttyyyyqqqxyyyyqqqqqxrr....rrrgsg.ihhhmr......',
      '.............zxutttwttyywtoyxqqxyytttttttuuxrr.....rra.Ammrr.......',
      '............zuwtttttttwwoywoyyqxywtwttttttwuoxr......grrrr.........',
      '.............wwtttttttwwwwowyqqxxyyyyywtttwwuuxr...................',
      '..........z.wwttttttwttwttwoyqxqqqqyowwttwtwwtwqzr.................',
      '.........gzowwtttttwwowttwoqxzxxqqqqyyowwwtwwttqxzz................',
      '........gxqqwtttttwwwyoooqxzzzzzzqqqqyyyowttwwoyqxzz...............',
      '........ruyoywwwwowyyytqxzrrg..rzzxqyyyotwtwwwyyqoxzg..............',
      '........zytyyyyyyyyyyyqqr........rzqqwtoywtwwqqxxqxzg..............',
      '.......rxyytyyyyyyqyywur..........rrzqwttwyqyqxxxqxxzz.............',
      '.....gzxxyyyyyyqxqyotur.............rqyqyyyyxxxxqxxxzz.............',
      '.....grqxyyyyqxqyottyqz..............zxxxxxxxxxxxxxxzz.............',
      '.......zqqyyyyyyyqyyyxqr.............zxqqqyqqqxxxxqxzz.............',
      '......Boxqqyyyyyyyyxxqqr............rqxxxxxxxxxxxxxxzz.............',
      '......mm.xqyyyyyqxqqxqz.............rqxxxxxxxxxxxxxrrz.............',
      '.....Bnm..xyyyyyyyqxzr..............grzxxxxxzxxzzzrB.gz............',
      '....grAnA.g...qxoxzzgg...............gzrxxzzzxzzg.Bmn.r............',
      '.....BBAnn....B.Bggg..................ggzzzggggg...nABg............',
      '....gBBBAnAABBBBBg......................gzzBBB...nnABBg............',
      '....BB.BAABBBBBBg..........................r..BmAnAAABBg...........',
      '..rrBAAAnnAAABr............................rBBBAAnnAAABrr..........',
      '.r.ninnnAnnABr..............................r.AAnnAAnnin...........',
      'rBAnnnnnnAAB.Brg............................rBBAAAnnnnnnn.r........',
      'rnnnnnnnnnnn..rg.............................r.Annnnnnnnnmr........'
    ]
  },
  bulma: {
    palette: {a: '#0c0c16', b: '#2a64a8', c: '#4a9ee0', d: '#8fd0f4', e: '#c98a60', f: '#801828', g: '#f4f6f8', h: '#f4caa4', i: '#c07010', j: '#f4ab1c', k: '#1c2440', l: '#7d4a26', m: '#34446c', n: '#5a3420', o: '#8a5a3a'},
    grid: [
      '.abbaccaadcbbbbbbbaa',
      'abcccaddaaddcaabbbaa',
      '.accadeffaaaaffabbbb',
      '..adcffffffaaaaaabba',
      '.acdfffbcadadacgaba.',
      '.abffbcbcadaadagcaa.',
      '..afbbaaacadadhagaba',
      '.abaaaaeabcgageagaba',
      '.aba.aaeeaaahhhagaga',
      '..aa.aaeehhhhheaaahg',
      '.abeaaaaaaehhhaaaaaa',
      '..aeaaeagdahhhaaaaaa',
      '..ahaaeagadhhhaaaaa.',
      '.aeefeeagaghhhaaaaa.',
      'ababaaeahahhhhaaaaa.',
      'abaaaeeehhhhhaaaaea.',
      'abbbaeeehhheeaaaaea.',
      '.aafaieeeiiiaaaaaba.',
      'aeiiaijeiaaaaiiiaba.',
      '.aaeiiiiiijjiaaagba.',
      '.abbaaaaiiiiiaaaga..',
      '.abbaaaaaaiiiaaaga..',
      'abbbaaaaiiiiiaaaga..',
      'akaa.aaijjjjjakagaa.',
      'akkaakajeiiiiakaaaga',
      'akaaakaaaagggaakagka',
      'akkaaaaaaagggaakaaa.',
      '.aaaaiiiijjjjiaka.a.',
      '.aaaaiiiijjjjjiaaaa.',
      'aaiiaijjijjjjjiaaaga',
      'llllljjjjjjjjjlaamla',
      'aakaaaajjjjjjlaamaa.',
      '.akakkaaaaaaala.a...',
      '.akakkkka.akmma.....',
      '.akakkkka.akmka.....',
      '.akkkaaa..akka......',
      'amkknaa...anka......',
      'amknnna...anna......',
      'amnnnma...annaaa....',
      'annona....annamma...',
      'anooka....annnaaka..',
      'knooka....ammkkka...',
      'aamoma.....aaaaa....'
    ]
  },
}

const SPRITE_NAMES = {
  goku: 'Son Goku', goku_nino: 'Son Goku (niño)', goku_ssj: 'Goku Super Saiyan', goku_ssj2: 'Goku Super Saiyan 2', goku_ssj3: 'Goku Super Saiyan 3',
  gohan: 'Son Gohan', gohan_ssj: 'Gohan Super Saiyan', krilin: 'Krilin', vegeta: 'Vegeta', vegeta_ssj: 'Vegeta Super Saiyan',
  piccolo: 'Piccolo', bulma: 'Bulma', bulma_joven: 'Bulma', raditz: 'Raditz',
  oolong: 'Oolong', yamcha: 'Yamcha', yamcha_z: 'Yamcha', puar: 'Puar', chichi: 'Chichí', chichi_nina: 'Chichí (niña)',
  roshi: 'Maestro Roshi', umigame: 'Umigame', pilaf: 'Emperador Pilaf', shu: 'Shu', gyumao: 'Ox-Satán', shenron: 'Shenron',
  tenshinhan: 'Tenshinhan', chaozu: 'Chaozu', a16: 'Androide 16', a17: 'Androide 17', a18: 'Androide 18',
  cell: 'Cell', buu: 'Majin Buu', trunks: 'Trunks', freezer: 'Freezer'
}
// altura de referencia (Goku) para mantener las proporciones entre personajes
export const SPRITE_REF_ROWS = 53
// sprites a otra resolución: filas que equivalen a la altura de Goku adulto
// (lámina de la época infantil ≈ 93 filas; lámina de la Z ≈ 72 filas; gigantes con menos)
const SHEET_KID = ['goku_nino', 'bulma_joven', 'oolong', 'yamcha', 'puar', 'chichi', 'roshi', 'umigame', 'pilaf', 'shu', 'chichi_nina']
const SHEET_Z = ['vegeta', 'gohan', 'piccolo', 'krilin', 'yamcha_z', 'tenshinhan', 'chaozu', 'a16', 'cell', 'buu', 'trunks', 'a18', 'a17', 'freezer']
const SPRITE_REFS = {
  ...Object.fromEntries(SHEET_KID.map(id => [id, 93])),
  ...Object.fromEntries(SHEET_Z.map(id => [id, 72])),
  gyumao: 62, shenron: 38
}

// Transformaciones disponibles por personaje (el botón ⚡ las recorre en orden)
export const FORMS = {
  goku: ['goku', 'goku_ssj', 'goku_ssj2', 'goku_ssj3'],
  gohan: ['gohan', 'gohan_ssj'],
  vegeta: ['vegeta', 'vegeta_ssj']
}

// Personajes listos para el juego: { name, grid, palette, ref?, spec? }
export const CHARACTERS = {
  ...Object.fromEntries(Object.entries(SPRITES).map(([id, sp]) => [id, { name: SPRITE_NAMES[id] || id, ...sp, ref: SPRITE_REFS[id] || SPRITE_REF_ROWS }])),
  ...Object.fromEntries(Object.entries(CHARACTER_SPECS).map(([id, spec]) => {
    const { grid, palette } = buildSprite(spec)
    // escala respecto a Goku: el lienzo del generador (SPRITE_H) equivale a su altura
    return [id, { name: spec.name, color: spec.colors?.top, grid, palette, spec, ref: spec.ref || SPRITE_H }]
  }))
}

// Grupos para la galería de personajes (Admin → Personajes)
export const CHARACTER_GROUPS = [
  { name: 'Libro 1 · La búsqueda de las esferas', ids: ['goku_nino', 'bulma_joven', 'oolong', 'yamcha', 'puar', 'roshi', 'umigame', 'chichi_nina', 'gyumao', 'pilaf', 'shu', 'shenron'] },
  { name: 'Dragon Ball Z · Protagonistas', ids: ['goku', 'gohan', 'krilin', 'vegeta', 'piccolo', 'bulma', 'chichi', 'yamcha_z', 'tenshinhan', 'chaozu', 'trunks'] },
  { name: 'Transformaciones', ids: ['goku_ssj', 'goku_ssj2', 'goku_ssj3', 'gohan_ssj', 'vegeta_ssj'] },
  { name: 'Rivales', ids: ['raditz', 'freezer', 'a16', 'a17', 'a18', 'cell', 'buu', 'dino'] },
  { name: 'Otros', ids: ['karin'] }
]
