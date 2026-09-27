// Mundos jugables. Varios pueden existir "en paralelo" (líneas temporales),
// como la Tierra del Futuro de Trunks respecto a la línea principal.

export const WORLDS = [
  {
    id: 'tierra',
    name: 'La Tierra',
    saga: 'Saga de las Esferas · Saga Saiyan',
    timeline: 'Línea principal',
    radius: 5,
    colors: { deep: '#1b4f9c', sea: '#2b7bd6', sand: '#e8d38a', land: '#4caf50', hill: '#2f7d32', peak: '#f2f2f2' },
    sky: '#0b0b2a',
    music: 'globo',
    locations: [
      { id: 'paoz', name: 'Montaña Paoz', lat: 32, lon: -20, landmark: 'cabin', map: 'paoz',
        desc: 'Bosques, ríos y la casita donde el abuelo Gohan crió a Goku.' },
      { id: 'kame', name: 'Kame House', lat: -8, lon: 38, landmark: 'kamehouse', map: 'kame', requires: 'm_esfera4',
        desc: 'Una isla diminuta en mitad del mar. El Maestro Roshi entrena (y lee revistas) aquí.' },
      { id: 'capsule', name: 'Capsule Corp', lat: 22, lon: 85, landmark: 'dome', map: 'capsule', requires: 'm_roshi_rimas',
        desc: 'La cúpula de la familia Brief en la Capital del Oeste. Todo cabe en una cápsula.' },
      { id: 'karin', name: 'Torre Karin', lat: 5, lon: 140, landmark: 'tower', map: 'karin', requires: 'm_radar',
        desc: 'Una torre tan alta que atraviesa las nubes. Arriba espera un gato muy sabio.' }
    ]
  },
  {
    id: 'kaio',
    name: 'Planeta de Kaio',
    saga: 'Saga Saiyan',
    timeline: 'Línea principal (Más Allá)',
    radius: 2.2,
    seed: 3,
    landBias: 0.6,
    colors: { deep: '#3f8d3a', sea: '#57b04d', sand: '#7ccf62', land: '#7ccf62', hill: '#5aa84b', peak: '#9be07e' },
    sky: '#f1c46a',
    music: 'globo',
    locked: true,
    locations: [
      { id: 'kaio_casa', name: 'Casa de Kaio', lat: 40, lon: 0, landmark: 'cabin', desc: 'Gravedad x10, un mono llamado Bubbles y chistes malos.' }
    ]
  },
  {
    id: 'namek',
    name: 'Namek',
    saga: 'Saga Freezer',
    timeline: 'Línea principal',
    radius: 4.6,
    seed: 7,
    landBias: -0.08,
    colors: { deep: '#1f7a6b', sea: '#35b3a0', sand: '#9fd8a7', land: '#5cbf8a', hill: '#2e8a5f', peak: '#c7f0d3' },
    sky: '#1a2e2a',
    music: 'globo',
    locked: true,
    locations: [
      { id: 'aldea_namek', name: 'Aldea de Guru', lat: 20, lon: 10, landmark: 'dome', desc: 'Casas-cúpula y siete esferas gigantes.' },
      { id: 'nave_freezer', name: 'Nave de Freezer', lat: -15, lon: 90, landmark: 'dome', desc: 'Aquí nadie te recibe con té.' }
    ]
  },
  {
    id: 'futuro',
    name: 'Tierra del Futuro',
    saga: 'Saga Androides',
    timeline: 'Línea paralela de Trunks',
    radius: 5,
    seed: 0, // misma geografía que la Tierra principal: es la misma Tierra en otra línea temporal
    colors: { deep: '#2b3550', sea: '#46557a', sand: '#8a826e', land: '#5d6653', hill: '#454a3f', peak: '#b8b8b8' },
    sky: '#141018',
    music: 'globo',
    locked: true,
    locations: [
      { id: 'ruinas', name: 'Ruinas de la Capital', lat: 25, lon: 70, landmark: 'dome', desc: 'Un mundo arrasado por los androides 17 y 18.' },
      { id: 'maquina', name: 'Máquina del Tiempo', lat: -5, lon: 20, landmark: 'cabin', desc: 'Bulma del futuro trabaja sin descanso.' }
    ]
  }
]

export function getWorld (id) {
  return WORLDS.find(w => w.id === id)
}

export function getLocation (id) {
  for (const w of WORLDS) {
    const l = w.locations.find(l => l.id === id)
    if (l) return { ...l, worldId: w.id }
  }
  return null
}
