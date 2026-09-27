// Construcción del planeta low-poly con ruido procedural y utilidades lat/lon.
import * as THREE from 'three'

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
  const geo = new THREE.IcosahedronGeometry(1, r > 3 ? 12 : 7)
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
