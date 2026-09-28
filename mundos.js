// MUNDOS — todo el contenido del juego: mundos, mapas de cada lugar,
// misiones (semilla; Admin puede añadir/sobrescribir como DLC) y música.

// ============================================================ MUNDOS
// Varios mundos pueden existir "en paralelo" (líneas temporales), como la
// Tierra del Futuro de Trunks respecto a la línea principal.

export const WORLDS = [
  {
    id: 'tierra',
    name: 'La Tierra',
    saga: 'Saga de las Esferas · Saga Saiyan',
    timeline: 'Línea principal',
    radius: 5,
    colors: { deep: '#2a74c8', sea: '#3d95e6', sand: '#f0dc8c', land: '#8ccf4c', hill: '#6db842', peak: '#f2f2f2' },
    sky: '#0b0b2a',
    // maqueta: fondo, carretera y decoración
    bg: 'linear-gradient(160deg, #5b2fb0 0%, #3a2aa8 45%, #22206e 100%)',
    roadAxis: [0.137, 0.981, 0.134],
    decoScale: 0.42,
    plaque: 'La Tierra',
    music: 'globo',
    locations: [
      { id: 'paoz', name: 'Montaña Paoz', lat: 32, lon: -20, landmark: 'cabin', map: 'paoz',
        desc: 'Bosques, ríos y la casita donde el abuelo Gohan crió a Goku.' },
      { id: 'kame', name: 'Kame House', lat: -8, lon: 38, landmark: 'kamehouse', map: 'kame', requires: 'm_gohan_estudia',
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
    radius: 2.6,
    seed: 3,
    landBias: 0.8,
    colors: { deep: '#6cbf3c', sea: '#7ccb44', sand: '#8fd34f', land: '#8fd34f', hill: '#6fbe3e', peak: '#9be07e' },
    sky: '#f1c46a',
    // réplica de la maqueta del planeta de Kaio
    bg: 'linear-gradient(160deg, #6a33c0 0%, #4a2cb8 40%, #2a2a9a 100%)',
    roadAxis: [0.394, 0.776, -0.493], // cruza el frente en diagonal, bajo la casa
    roadWidth: 0.36,
    decoScale: 0.7,
    tileSize: 0.24,
    treeScale: 1.7,
    trees: 9,
    flowers: 60,
    snakeWay: true,
    stand: true, // peana con nubes y placa, como la maqueta de referencia
    plaque: 'Planeta de Kaio',
    extras: [
      { kind: 'car', lat: 43, lon: -52, spin: 2.2, scale: 1.3 },
      { kind: 'kaio', lat: 38, lon: 42, spin: 0.4, scale: 1.3 },
      { kind: 'bubbles', lat: 50, lon: 8, scale: 1.4 },
      { kind: 'gregory', lat: 40, lon: 22, scale: 1.4 },
      { kind: 'well', lat: 52, lon: 76, scale: 1.2 }
    ],
    music: 'globo',
    locked: true,
    locations: [
      { id: 'kaio_casa', name: 'Casa de Kaio', lat: 68, lon: 10, landmark: 'kaiohouse', desc: 'Gravedad x10, un mono llamado Bubbles y chistes malos.' }
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
    colors: { deep: '#1f8a7b', sea: '#35c3b0', sand: '#b8e8b0', land: '#6fd08a', hill: '#3fa06a', peak: '#c7f0d3' },
    sky: '#1a2e2a',
    bg: 'linear-gradient(160deg, #1f6a5a 0%, #2a8a6a 45%, #103a3a 100%)',
    decoScale: 0.42,
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
    colors: { deep: '#2b3550', sea: '#46557a', sand: '#8a826e', land: '#6d7663', hill: '#555a4f', peak: '#b8b8b8' },
    sky: '#141018',
    bg: 'linear-gradient(160deg, #3a2a3a 0%, #2a2030 45%, #0f0c14 100%)',
    roadAxis: [0.3, 1, 0.55],
    decoScale: 0.42,
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

// ============================================================ MAPAS

export const TILES = {
  '.': { name: 'hierba', color: '#5cb85c', h: 0.3, walk: true },
  ',': { name: 'camino', color: '#c9a36b', h: 0.26, walk: true },
  s: { name: 'arena', color: '#ecd9a0', h: 0.26, walk: true },
  '~': { name: 'agua', color: '#2b7bd6', h: 0.1, walk: false, water: true },
  T: { name: 'árbol', color: '#4a9f4a', h: 0.3, walk: false, tree: true },
  '#': { name: 'roca', color: '#8d8d99', h: 1.2, walk: false },
  f: { name: 'suelo', color: '#d8d8e0', h: 0.3, walk: true },
  g: { name: 'jardín', color: '#7fd07a', h: 0.3, walk: true },
  C: { name: 'nubes', color: '#f4f6ff', h: 0.12, walk: false, cloud: true }
}

export const MAPS = {
  paoz: {
    start: [6, 12],
    music: 'paoz',
    tiles: [
      'TTTTTTTTTTTTTT',
      'T....TT.....TT',
      'T.........T..T',
      'T.....,,,....T',
      'T.....,..~~~.T',
      'TT...,,..~~~.T',
      'T...,,...~~~.T',
      'T..,,....~~..T',
      'T..,....T....T',
      'T..,,,.....#.T',
      'T....,,..###.T',
      'TT....,.....TT',
      'T.....,......T',
      'TTTTTT,TTTTTTT'
    ],
    props: [
      { id: 'casa', kind: 'cabin', x: 2, y: 2, name: 'Casa del abuelo Gohan',
        lines: [{ who: 'Goku', text: 'Mi casa. Huele a arroz y a leña. ¡Qué hambre!' }] },
      { id: 'altar', kind: 'altar', x: 4, y: 2, name: 'Altar del abuelo',
        lines: [{ who: 'Goku', text: 'Abuelito, hoy también voy a entrenar mucho.' }] },
      { id: 'chichi_npc', kind: 'npc', sprite: 'chichi', x: 3, y: 3, name: 'Chichí',
        lines: [{ who: 'Chichí', text: '¡Goku! Si ves a Gohan jugando en vez de estudiar, me lo traes. ¡Y lávate las manos antes de cenar!' }] },
      { id: 'cartel', kind: 'sign', x: 7, y: 12, name: 'Cartel',
        lines: [{ who: 'Cartel', text: '«MONTAÑA PAOZ. Cuidado con los dinosaurios. Y con los tigres. Y con Goku.»' }] }
    ]
  },
  kame: {
    start: [5, 9],
    music: 'kame',
    tiles: [
      '~~~~~~~~~~~~',
      '~~~~ssss~~~~',
      '~~~ssssss~~~',
      '~~sssggsss~~',
      '~~ssggggss~~',
      '~~ssggggss~~',
      '~~sssggsss~~',
      '~~ssssssss~~',
      '~~~ssssss~~~',
      '~~~~ssss~~~~',
      '~~~~~~~~~~~~',
      '~~~~~~~~~~~~'
    ],
    props: [
      { id: 'kamehouse', kind: 'kamehouse', x: 5, y: 3, name: 'Kame House',
        lines: [{ who: 'Goku', text: 'Una casa rosa con el rótulo KAME HOUSE. ¡Qué pequeña es la isla!' }] },
      { id: 'roshi', kind: 'npc', sprite: 'roshi', x: 6, y: 5, name: 'Maestro Roshi',
        lines: [{ who: 'Roshi', text: 'Jo, jo, jo. ¿Has traído alguna revista... educativa?' }] },
      { id: 'krilin_npc', kind: 'npc', sprite: 'krilin', x: 8, y: 7, name: 'Krilin',
        lines: [{ who: 'Krilin', text: '¡Eh! Yo llegué primero. El maestro es mío... bueno, compartimos.' }] },
      { id: 'umigame', kind: 'npc', sprite: 'umigame', x: 4, y: 8, name: 'Umigame',
        lines: [{ who: 'Umigame', text: 'Llevo mil años viviendo con el Maestro Roshi. He visto cosas... que es mejor no contar.' }] },
      { id: 'palmera', kind: 'palm', x: 3, y: 4, name: 'Palmera',
        lines: [{ who: 'Goku', text: 'Una palmera. Tiene cocos. ¿Se comerán?' }] }
    ]
  },
  capsule: {
    start: [6, 10],
    music: 'capsule',
    tiles: [
      '############',
      '#ffffffffff#',
      '#ffffffffff#',
      '#ffgggggfff#',
      '#ffgggggfff#',
      '#ffffffffff#',
      '#ff,,,,,,ff#',
      '#ff,ffff,ff#',
      '#ff,ffff,ff#',
      '#ff,,,,,,ff#',
      '#ffffffffff#',
      '#####ff#####'
    ],
    props: [
      { id: 'cupula', kind: 'dome', x: 5, y: 2, name: 'Capsule Corporation',
        lines: [{ who: 'Goku', text: 'Una casa redonda como un bollo gigante.' }] },
      { id: 'bulma_npc', kind: 'npc', sprite: 'bulma', x: 8, y: 4, name: 'Bulma',
        lines: [{ who: 'Bulma', text: '¡No toques nada! Todo aquí es un prototipo… o explota.' }] },
      { id: 'oolong_npc', kind: 'npc', sprite: 'oolong', x: 3, y: 8, name: 'Oolong',
        lines: [{ who: 'Oolong', text: 'Yo solo pasaba por aquí. No he cogido nada. ¿Por qué me miras así?' }] },
      { id: 'capsulas', kind: 'crate', x: 9, y: 8, name: 'Caja de cápsulas',
        lines: [{ who: 'Goku', text: 'Cápsulas numeradas: casa, moto, avión... ¡y nevera!' }] }
    ]
  },
  karin: {
    start: [5, 8],
    music: 'karin',
    tiles: [
      'CCCCCCCCCCCC',
      'CCCCffffCCCC',
      'CCCffffffCCC',
      'CCffffffffCC',
      'CCffffffffCC',
      'CCffffffffCC',
      'CCffffffffCC',
      'CCCffffffCCC',
      'CCCCffffCCCC',
      'CCCCCCCCCCCC'
    ],
    props: [
      { id: 'karin_npc', kind: 'npc', sprite: 'karin', x: 6, y: 3, name: 'Karin',
        lines: [{ who: 'Karin', text: 'Has subido toda la torre sin volar. Interesante, muchacho.' }] },
      { id: 'jarra', kind: 'jar', x: 3, y: 4, name: 'Agua Ultrasagrada',
        lines: [{ who: 'Goku', text: 'Una jarra que brilla. Seguro que no está tan rica como parece.' }] },
      { id: 'pilar', kind: 'pillar', x: 8, y: 5, name: 'Columna',
        lines: [{ who: 'Goku', text: 'Desde aquí se ve toda la Tierra. ¡Y el Palacio de Kamisama arriba!' }] }
    ]
  }
}

// ============================================================ MISIONES
// Misiones "semilla". Al arrancar se combinan con las publicadas desde el
// panel Admin (Firestore o localStorage), que pueden añadir misiones nuevas
// (packs DLC) o sobrescribir estas por id.
//
// Tipos de paso:
//   talk    → hablar con un prop/npc (target)
//   goto    → acercarse a un prop (target)
//   battle  → minijuego contra un rival
//             (game: rps | tictactoe | rhyme | kiseq | shell | quiz | reflex | memory)
//   collect → recoger un objeto (target) → se añade al inventario (item)
// "spawns" añade props al mapa mientras la misión está activa, entre los pasos
// fromStep y untilStep (incluidos). "playAs" cambia el personaje durante la
// misión (p. ej. Goku niño en un recuerdo).
//
// GUION · MUNDO 1: LA TIERRA (de la infancia de Goku a la llegada de Raditz)
//   Montaña Paoz  → recuerdo de la esfera · Gohan tiene que estudiar · la cena de los Saiyans
//   Kame House    → la reunión · las gafas de Roshi · el hermano del espacio (Raditz)
//   Capsule Corp  → el radar del dragón · el lío de las cápsulas · el scouter de Raditz
//   Torre Karin   → el agua ultrasagrada · las adivinanzas de Karin

export const SEED_MISSIONS = [
  // ---------------------------------------------------------------- MONTAÑA PAOZ
  {
    id: 'm_esfera4',
    pack: 'base',
    worldId: 'tierra',
    locationId: 'paoz',
    playAs: 'goku_nino',
    title: 'Recuerdo: la esfera de cuatro estrellas',
    summary: 'Años atrás, un Goku muy pequeño pierde el tesoro de su abuelo... por culpa de un dinosaurio con hambre.',
    music: 'paoz',
    intro: [
      { who: 'Narrador', text: 'Hace muchos años, en la Montaña Paoz, vivía un niño con cola que comía más que diez leñadores.' },
      { who: 'Goku', text: '¡Buenos días, abuelito! ...¿Eh? ¿Dónde está tu esfera?' }
    ],
    spawns: [
      { id: 'huellas', kind: 'footprints', x: 10, y: 8, name: 'Huellas gigantes', fromStep: 1 },
      { id: 'dino', kind: 'npc', sprite: 'dino', x: 11, y: 11, name: 'Dinosaurio glotón', fromStep: 2, untilStep: 2 },
      { id: 'esfera4', kind: 'ball', stars: 4, x: 10, y: 11, name: 'Esfera de 4 estrellas', fromStep: 3, untilStep: 3 }
    ],
    steps: [
      { type: 'talk', target: 'altar', hint: 'Mira el altar del abuelo (junto a la casa).',
        lines: [
          { who: 'Goku', text: 'El cojín está vacío... ¡La esfera de cuatro estrellas no está!' },
          { who: 'Goku', text: 'Hay barro en el suelo. Algo MUY grande ha pasado por aquí.' }
        ] },
      { type: 'goto', target: 'huellas', hint: 'Sigue el rastro hacia el río.',
        lines: [
          { who: 'Goku', text: 'Huellas de tres dedos... y huelen a pescado. ¡Un dinosaurio!' },
          { who: 'Goku', text: 'Van hacia las rocas del sureste.' }
        ] },
      { type: 'battle', target: 'dino', game: 'rps', config: { bestOf: 3 }, hint: 'Enfréntate al dinosaurio.',
        lines: [
          { who: 'Dinosaurio', text: '¡GROAAAR! (Se relame. Tiene algo brillante entre los dientes.)' },
          { who: 'Goku', text: '¡Devuélvemela! Te reto al Jan-Ken: ¡piedra, papel o tijera!' }
        ],
        win: [{ who: 'Dinosaurio', text: '¡GROA...! ¡Achís! (La esfera sale disparada y rueda por la hierba.)' }],
        lose: [{ who: 'Dinosaurio', text: '¡GROAR! (Se ríe con la boca llena. Quiere la revancha.)' }] },
      { type: 'collect', target: 'esfera4', item: 'esfera_4', hint: 'Recoge la esfera.',
        lines: [
          { who: 'Goku', text: '¡La tengo! Brilla como un sol pequeñito... Abuelito, ya estás en casa.' },
          { who: 'Narrador', text: 'Años después, esa misma esfera brillará en el sombrero del hijo de Goku...' }
        ] }
    ],
    reward: { zeni: 100, items: [], characters: [] }
  },
  {
    id: 'm_gohan_estudia',
    pack: 'base',
    worldId: 'tierra',
    locationId: 'paoz',
    requires: ['m_esfera4'],
    title: '¡Gohan tiene que estudiar!',
    summary: 'Chichí quiere un hijo investigador. Gohan quiere perseguir mariposas. Goku... quiere comer.',
    music: 'paoz',
    intro: [
      { who: 'Narrador', text: 'Montaña Paoz, cinco años después. Goku ya es padre... y Chichí tiene un plan: ¡su hijo será un gran investigador!' }
    ],
    spawns: [
      { id: 'huellas_gohan', kind: 'footprints', x: 8, y: 6, name: 'Huellas pequeñitas', fromStep: 1, untilStep: 1 },
      { id: 'gohan', kind: 'npc', sprite: 'gohan', x: 12, y: 5, name: 'Gohan', fromStep: 1, untilStep: 3 }
    ],
    steps: [
      { type: 'talk', target: 'chichi_npc', hint: 'Habla con Chichí.',
        lines: [
          { who: 'Chichí', text: '¡Goku! Gohan se ha escapado OTRA VEZ en mitad de la lección de álgebra.' },
          { who: 'Chichí', text: 'Tráelo de vuelta. ¡Y ni se te ocurra enseñarle a pelear!' },
          { who: 'Goku', text: 'Jejeje... vale, vale.' }
        ] },
      { type: 'goto', target: 'huellas_gohan', hint: 'Busca pistas de Gohan.',
        lines: [
          { who: 'Goku', text: 'Huellas pequeñitas... y un libro abandonado: «Matemáticas para genios de cuatro años».' },
          { who: 'Goku', text: 'Van hacia el río. ¡Gohan, sal de donde estés!' }
        ] },
      { type: 'talk', target: 'gohan', hint: 'Encuentra a Gohan junto al río.',
        lines: [
          { who: 'Gohan', text: '¡Papá! No me escapé... ¡estaba estudiando a los peces! Eso también es ciencia.' },
          { who: 'Goku', text: 'Jajaja. Anda, volvamos, que tu madre da más miedo que un dinosaurio.' }
        ] },
      { type: 'battle', target: 'chichi_npc', game: 'quiz', config: { topic: 'examen', rounds: 5, seconds: 12 }, hint: 'Supera el examen de Chichí.',
        lines: [
          { who: 'Chichí', text: 'Para comprobar que ha estudiado... ¡un examen! Y tú también, Goku. Ayúdale.' },
          { who: 'Goku', text: '¿Un examen? Prefiero pelear con Piccolo...' }
        ],
        win: [
          { who: 'Chichí', text: '¡Sobresaliente! Bueno... podéis ir a visitar a vuestros amigos a Kame House.' },
          { who: 'Gohan', text: '¡Bieeen! ¿Me llevas en la Nube Kinton, papá?' }
        ],
        lose: [{ who: 'Chichí', text: '¡Suspenso! Otra vez a la mesa. ¡Y nada de postre!' }] }
    ],
    reward: { zeni: 120, items: [], characters: ['gohan'] }
  },
  {
    id: 'm_cena',
    pack: 'base',
    worldId: 'tierra',
    locationId: 'paoz',
    requires: ['m_gohan_estudia'],
    title: 'La cena de los Saiyans',
    summary: 'La despensa está vacía y en casa hay dos estómagos Saiyan. Toca pescar... a lo grande.',
    music: 'paoz',
    intro: [
      { who: 'Chichí', text: '¡No queda NADA en la despensa! Y vosotros dos coméis por veinte.' }
    ],
    spawns: [
      { id: 'pesca', kind: 'fishspot', x: 8, y: 7, name: 'Poza del río', fromStep: 1, untilStep: 1 }
    ],
    steps: [
      { type: 'talk', target: 'chichi_npc', hint: 'Habla con Chichí.',
        lines: [
          { who: 'Chichí', text: 'Traedme el pez más grande del río. ¡Y sin destrozar la cocina como la última vez!' },
          { who: 'Goku', text: '¡Hecho! Gohan, hoy aprendes el método Son: ¡pescar con la cola!' }
        ] },
      { type: 'battle', target: 'pesca', game: 'reflex', config: { theme: 'fish', rounds: 3 }, hint: 'Pesca el pez gigante en la poza.',
        lines: [
          { who: 'Gohan', text: '¡Papá, algo enorme está mordiendo mi cola!' },
          { who: 'Goku', text: '¡Espera a que pique y tira justo en el momento! ¡Ahora no... ahora no... AHORA!' }
        ],
        win: [{ who: 'Narrador', text: '¡Un pez tan grande como la casa! Esa noche nadie pasa hambre en la Montaña Paoz.' }],
        lose: [{ who: 'Narrador', text: 'El pez se escapa salpicando a Goku de arriba abajo. Gohan no puede parar de reír.' }] },
      { type: 'talk', target: 'chichi_npc', hint: 'Lleva la cena a Chichí.',
        lines: [
          { who: 'Chichí', text: '¡Así me gusta! Aunque... ¿cómo pensáis meter esto en la cazuela?' },
          { who: 'Goku', text: '¡Por partes! Jejeje. ¿Hay postre?' }
        ] }
    ],
    reward: { zeni: 80, items: [], characters: [] }
  },

  // ---------------------------------------------------------------- KAME HOUSE
  {
    id: 'm_roshi_rimas',
    pack: 'base',
    worldId: 'tierra',
    locationId: 'kame',
    requires: ['m_gohan_estudia'],
    title: 'La reunión en Kame House',
    summary: 'Los viejos amigos se reúnen... y descubren que Goku tiene un hijo. Roshi lo celebra a su manera.',
    music: 'kame',
    intro: [
      { who: 'Narrador', text: 'Cinco años después del último Torneo de Artes Marciales, los amigos se reúnen en la isla del Maestro Roshi.' }
    ],
    spawns: [
      { id: 'gohan_k', kind: 'npc', sprite: 'gohan', x: 5, y: 6, name: 'Gohan', fromStep: 0 }
    ],
    steps: [
      { type: 'talk', target: 'krilin_npc', hint: 'Saluda a Krilin.',
        lines: [
          { who: 'Krilin', text: '¡Goku! ¡Cuánto tiempo! ¿Y ese niño que se esconde detrás de ti?' },
          { who: 'Goku', text: '¡Es mi hijo! Se llama Gohan, como mi abuelo.' },
          { who: 'Krilin', text: '¿¡TU HIJO!? ¡Si tú no sabías ni lo que era casarse!' }
        ] },
      { type: 'talk', target: 'roshi', hint: 'Habla con el Maestro Roshi.',
        lines: [
          { who: 'Roshi', text: 'Jo, jo, jo... Y lleva la esfera de cuatro estrellas en el sombrero. ¡Qué recuerdos!' },
          { who: 'Roshi', text: 'Celebremos el reencuentro como en mis tiempos: ¡con un duelo de rimas!' }
        ] },
      { type: 'battle', target: 'roshi', game: 'rhyme', config: { rounds: 5, seconds: 8 }, hint: 'Duelo de rimas con Roshi.',
        lines: [{ who: 'Roshi', text: 'Yo digo una palabra y tú eliges la que rima. ¡El que pierda friega los platos!' }],
        win: [
          { who: 'Roshi', text: '¡Jo, jo! Tienes oído de campeón.' },
          { who: 'Krilin', text: 'Pues me toca fregar a mí... como siempre.' }
        ],
        lose: [{ who: 'Roshi', text: '¡A fregar, Goku! Jo, jo, jo.' }] }
    ],
    reward: { zeni: 150, items: [], characters: ['krilin'] }
  },
  {
    id: 'm_gafas_roshi',
    pack: 'base',
    worldId: 'tierra',
    locationId: 'kame',
    requires: ['m_roshi_rimas'],
    title: '¿Dónde están mis gafas?',
    summary: 'El Maestro Roshi no ve nada sin sus gafas de sol. Umigame las escondió... y no recuerda dónde.',
    music: 'kame',
    intro: [
      { who: 'Roshi', text: '¡Sin mis gafas de sol no distingo a Krilin de una bola de billar!' },
      { who: 'Krilin', text: '¡Oiga!' }
    ],
    steps: [
      { type: 'talk', target: 'roshi', hint: 'Habla con Roshi.',
        lines: [{ who: 'Roshi', text: 'Umigame siempre lo guarda todo. ¡Pregúntale a ella!' }] },
      { type: 'talk', target: 'umigame', hint: 'Pregunta a Umigame (la tortuga).',
        lines: [
          { who: 'Umigame', text: 'Las escondí bajo una concha para que nadie las pisara... pero no recuerdo cuál.' },
          { who: 'Umigame', text: 'Las moveré despacio... bueno, despacio para ser una tortuga.' }
        ] },
      { type: 'battle', target: 'umigame', game: 'shell', config: { rounds: 3, swaps: 5, item: 'gafas' }, hint: 'Sigue la concha con las gafas.',
        lines: [{ who: 'Umigame', text: '¡Atento! Concha, concha, concha...' }],
        win: [{ who: 'Roshi', text: '¡Mis gafas! Ahora lo veo todo clarísimo... ¡Anda, si se ha hecho de noche! Jo, jo.' }],
        lose: [{ who: 'Umigame', text: 'Uy, esa concha estaba vacía. Solo había un cangrejo muy ofendido.' }] }
    ],
    reward: { zeni: 90, items: [], characters: [] }
  },
  {
    id: 'm_raditz',
    pack: 'base',
    worldId: 'tierra',
    locationId: 'kame',
    requires: ['m_roshi_rimas'],
    title: 'El hermano del espacio',
    summary: 'Un guerrero con armadura aterriza en la isla. Dice ser el hermano de Goku... y viene a por Gohan.',
    music: 'batalla',
    intro: [
      { who: 'Narrador', text: 'De repente, algo cae del cielo junto a la isla. De la nave sale un guerrero con armadura y una melena interminable...' }
    ],
    spawns: [
      { id: 'gohan_r', kind: 'npc', sprite: 'gohan', x: 5, y: 6, name: 'Gohan', fromStep: 0, untilStep: 2 },
      { id: 'raditz', kind: 'npc', sprite: 'raditz', x: 7, y: 2, name: 'Raditz', fromStep: 0, untilStep: 2 },
      { id: 'piccolo_k', kind: 'npc', sprite: 'piccolo', x: 3, y: 6, name: 'Piccolo', fromStep: 3 }
    ],
    steps: [
      { type: 'talk', target: 'raditz', hint: 'Enfréntate al desconocido.',
        lines: [
          { who: 'Raditz', text: 'Así que tú eres Kakarotto. Has crecido... pero te has vuelto blando.' },
          { who: 'Raditz', text: 'Soy Raditz, tu hermano mayor. Eres un Saiyan, enviado de bebé a conquistar este planeta.' },
          { who: 'Goku', text: '¿Mi... hermano? ¡Yo me llamo Son Goku y la Tierra es mi hogar!' }
        ] },
      { type: 'battle', target: 'raditz', game: 'rps', config: { bestOf: 5 }, hint: 'Protege a Gohan de Raditz.',
        lines: [
          { who: 'Raditz', text: 'Si no te unes a mí, me llevaré a tu hijo.' },
          { who: 'Goku', text: '¡No toques a Gohan! ¡Te reto al Jan-Ken, piedra, papel o tijera!' }
        ],
        win: [{ who: 'Raditz', text: '¡Grr! Tienes reflejos... pero mi nivel de pelea sigue siendo muy superior.' }],
        lose: [{ who: 'Raditz', text: 'Patético. Mi scouter marca que tu nivel de pelea es solo de 334...' }] },
      { type: 'talk', target: 'raditz', hint: 'Detén a Raditz.',
        lines: [
          { who: 'Raditz', text: '¡Me llevo al niño! Si quieres recuperarlo, elimina a cien terrícolas antes de mañana.' },
          { who: 'Gohan', text: '¡Papááá!' },
          { who: 'Narrador', text: 'Raditz despega con Gohan bajo el brazo. Entonces, una silueta con turbante aterriza en la arena...' }
        ] },
      { type: 'talk', target: 'piccolo_k', hint: 'Habla con Piccolo.',
        lines: [
          { who: 'Piccolo', text: 'Ese Saiyan es un estorbo para mis planes de conquistar la Tierra.' },
          { who: 'Piccolo', text: 'Por esta vez lucharemos juntos, Goku. Tengo una técnica nueva: el Makankosappo.' },
          { who: 'Goku', text: '¿Piccolo... ayudándome a mí? ¡Esto sí que no me lo esperaba!' }
        ] },
      { type: 'battle', target: 'piccolo_k', game: 'kiseq', config: { length: 7 }, hint: 'Carga el Makankosappo con Piccolo.',
        lines: [{ who: 'Piccolo', text: 'Necesito tiempo para concentrar mi ki. ¡Repite mi secuencia y no falles!' }],
        win: [
          { who: 'Narrador', text: '¡El Makankosappo atraviesa a Raditz! Goku lo sujeta hasta el final... y se sacrifica para salvar a Gohan.' },
          { who: 'Piccolo', text: 'Hmph. Las Esferas del Dragón te devolverán la vida. Mientras tanto, yo entrenaré al niño.' },
          { who: 'Narrador', text: 'En el Más Allá, un camino de un millón de kilómetros espera a Goku... (Continuará en el Planeta de Kaio)' }
        ],
        lose: [{ who: 'Piccolo', text: '¡Demasiado lento! Concéntrate o Raditz escapará.' }] }
    ],
    reward: { zeni: 300, items: [], characters: ['piccolo'] }
  },

  // ---------------------------------------------------------------- CAPSULE CORP
  {
    id: 'm_radar',
    pack: 'base',
    worldId: 'tierra',
    locationId: 'capsule',
    requires: ['m_roshi_rimas'],
    title: 'El radar del dragón',
    summary: 'Bulma necesita calibrar su radar... y alguien con cola de cerdo se ha llevado la pieza clave.',
    music: 'capsule',
    intro: [
      { who: 'Narrador', text: 'Capital del Oeste. Coches voladores, robots y un laboratorio que huele a café recién hecho.' }
    ],
    steps: [
      { type: 'talk', target: 'bulma_npc', hint: 'Habla con Bulma.',
        lines: [
          { who: 'Bulma', text: '¡Goku! Justo a tiempo. ¡Mi radar del dragón se ha vuelto loco!' },
          { who: 'Bulma', text: 'Repite la secuencia de ki exactamente como la marque la pantalla. Sin fallar.' }
        ] },
      { type: 'battle', target: 'bulma_npc', game: 'kiseq', config: { length: 6 }, hint: 'Calibra el radar con Bulma.',
        lines: [{ who: 'Bulma', text: 'Rojo, azul, amarillo, verde... ¡Memoriza!' }],
        win: [{ who: 'Bulma', text: '¡Perfecto! Solo falta el chip de antena... ¡OOLONG! ¡Devuélvelo ahora mismo!' }],
        lose: [{ who: 'Bulma', text: '¡Casi lo quemas! Venga, otra vez.' }] },
      { type: 'battle', target: 'oolong_npc', game: 'tictactoe', config: { level: 'normal' }, hint: 'Recupera el chip de Oolong.',
        lines: [{ who: 'Oolong', text: '¿El chip? Te lo doy si me ganas al tres en raya. ¡Yo soy la X y tú la esfera!' }],
        win: [{ who: 'Oolong', text: 'Bah... toma tu chip. Pero la nevera sigue siendo mía.' }],
        lose: [{ who: 'Oolong', text: '¡Ja! Los cerdos también somos listos.' }] }
    ],
    reward: { zeni: 200, items: ['radar'], characters: ['bulma'] }
  },
  {
    id: 'm_capsulas',
    pack: 'base',
    worldId: 'tierra',
    locationId: 'capsule',
    requires: ['m_radar'],
    title: 'El lío de las cápsulas',
    summary: 'La madre de Bulma ha vaciado la caja de cápsulas para hacer sitio a sus galletas. ¡Hay que emparejarlas!',
    music: 'capsule',
    intro: [
      { who: 'Bulma', text: '¡MAMÁ! ¿Has sacado todas las cápsulas de su caja para guardar galletas?' }
    ],
    steps: [
      { type: 'talk', target: 'bulma_npc', hint: 'Habla con Bulma.',
        lines: [
          { who: 'Bulma', text: 'Cada cápsula tiene su pareja de repuesto. Si las emparejo mal... ¡podría salir una casa dentro del laboratorio!' },
          { who: 'Goku', text: 'Yo tengo buena memoria para la comida. ¡Seguro que para esto también!' }
        ] },
      { type: 'battle', target: 'capsulas', game: 'memory', config: { pairs: 6 }, hint: 'Empareja las cápsulas.',
        lines: [{ who: 'Bulma', text: 'Destápalas de dos en dos. ¡Y cuidado con la número 7, que es un avión!' }],
        win: [{ who: 'Bulma', text: '¡Todas en su sitio! Casa, moto, avión, submarino... ¿y esta nevera?' }],
        lose: [{ who: 'Bulma', text: '¡Nooo! Acaba de aparecer una moto en el jardín. Otra vez.' }] },
      { type: 'talk', target: 'oolong_npc', hint: 'Devuelve la nevera a Oolong.',
        lines: [
          { who: 'Oolong', text: '¡Eh, esa nevera es mía! Vale, vale... toma un bocadillo como agradecimiento.' },
          { who: 'Goku', text: '¡Gracias, Oolong! ¿Solo uno?' }
        ] }
    ],
    reward: { zeni: 100, items: [], characters: [] }
  },
  {
    id: 'm_scouter',
    pack: 'base',
    worldId: 'tierra',
    locationId: 'capsule',
    requires: ['m_raditz', 'm_radar'],
    title: 'El scouter de Raditz',
    summary: 'Bulma estudia el aparato que llevaba Raditz en el ojo. Lo que descubre no es nada bueno...',
    music: 'capsule',
    intro: [
      { who: 'Narrador', text: 'Tras la batalla contra Raditz, Krilin trae a la Capsule Corp el extraño aparato que el Saiyan llevaba en el ojo.' }
    ],
    steps: [
      { type: 'talk', target: 'bulma_npc', hint: 'Habla con Bulma.',
        lines: [
          { who: 'Bulma', text: 'Esto es un scouter: mide el nivel de pelea... y ¡también es un comunicador!' },
          { who: 'Bulma', text: 'Sintoniza la frecuencia justo cuando la aguja pase por la zona verde.' }
        ] },
      { type: 'battle', target: 'bulma_npc', game: 'reflex', config: { theme: 'scouter', rounds: 3 }, hint: 'Sintoniza el scouter.',
        lines: [{ who: 'Bulma', text: '¡Con cuidado! Si te pasas, se quema.' }],
        win: [
          { who: 'Scouter', text: '«...Raditz ha caído. Iremos a la Tierra a por las Esferas del Dragón. Llegaremos en un año. Vegeta, fuera.»' },
          { who: 'Bulma', text: '¡Dos Saiyans más, todavía más fuertes que Raditz! Tenemos un año para prepararnos.' },
          { who: 'Narrador', text: 'La Tierra se prepara para su mayor batalla... (Fin del primer mundo)' }
        ],
        lose: [{ who: 'Bulma', text: 'Solo se oye ruido... ¡Inténtalo otra vez!' }] }
    ],
    reward: { zeni: 250, items: ['scouter'], characters: [] }
  },

  // ---------------------------------------------------------------- TORRE KARIN
  {
    id: 'm_senzu',
    pack: 'base',
    worldId: 'tierra',
    locationId: 'karin',
    requires: ['m_radar'],
    title: 'El agua ultrasagrada',
    summary: 'Karin guarda una jarra que te hará más fuerte... si consigues seguirle el ritmo.',
    music: 'karin',
    intro: [
      { who: 'Narrador', text: 'Tras escalar sin descanso, Goku llega a la cima de la Torre Karin, por encima de las nubes.' }
    ],
    spawns: [
      { id: 'senzu', kind: 'bean', x: 5, y: 2, name: 'Semilla del ermitaño', fromStep: 2, untilStep: 2 }
    ],
    steps: [
      { type: 'talk', target: 'karin_npc', hint: 'Habla con Karin.',
        lines: [{ who: 'Karin', text: '¿Quieres el agua ultrasagrada? Esconderé la jarra entre tres. Sigue el movimiento.' }] },
      { type: 'battle', target: 'karin_npc', game: 'shell', config: { rounds: 3, swaps: 6 }, hint: 'Sigue la jarra.',
        lines: [{ who: 'Karin', text: 'No parpadees. Ni siquiera tu cola puede seguirme.' }],
        win: [{ who: 'Karin', text: 'Bien visto. Como premio... una semilla del ermitaño. Está allí, junto al borde.' }],
        lose: [{ who: 'Karin', text: 'Demasiado lento. El Maestro Roshi tardó tres años. ¡Otra vez!' }] },
      { type: 'collect', target: 'senzu', item: 'senzu', hint: 'Recoge la semilla.',
        lines: [{ who: 'Goku', text: 'Una judía pequeñita... ¡y me quita el hambre de golpe! Bueno, casi.' }] }
    ],
    reward: { zeni: 300, items: [], characters: [] }
  },
  {
    id: 'm_adivinanzas_karin',
    pack: 'base',
    worldId: 'tierra',
    locationId: 'karin',
    requires: ['m_senzu'],
    title: 'Las adivinanzas de Karin',
    summary: 'Yajirobe se ha comido las semillas otra vez. Karin solo te dará la última si piensas tan rápido como luchas.',
    music: 'karin',
    intro: [
      { who: 'Karin', text: 'Yajirobe se ha vuelto a comer las semillas del ermitaño. ¡Ese glotón no tiene remedio!' }
    ],
    steps: [
      { type: 'talk', target: 'karin_npc', hint: 'Habla con Karin.',
        lines: [
          { who: 'Karin', text: 'Me queda una sola. Te la daré si resuelves mis adivinanzas.' },
          { who: 'Goku', text: '¿Adivinanzas? ¿No podemos echar una carrerita?' }
        ] },
      { type: 'battle', target: 'karin_npc', game: 'quiz', config: { topic: 'karin', rounds: 5, seconds: 14 }, hint: 'Resuelve las adivinanzas de Karin.',
        lines: [{ who: 'Karin', text: 'La mente también se entrena, muchacho.' }],
        win: [{ who: 'Karin', text: 'Muy bien. Toma la última semilla... y escóndela de Yajirobe.' }],
        lose: [{ who: 'Karin', text: 'Hmm. Medita un poco más y vuelve a intentarlo.' }] }
    ],
    reward: { zeni: 150, items: ['senzu'], characters: [] }
  }
]

// ============================================================ MÚSICA
// Pistas chiptune originales (compuestas para el juego, sin samples externos).
// Cada token es una corchea: nota (C4, F#5...), '-' mantiene, '.' silencio.
// Batería: k = bombo, s = caja, h = charles, '.' silencio.
// Todas las pistas se repiten en bucle. Se pueden añadir más desde datos/Admin.

export const TRACKS = {
  globo: {
    bpm: 92,
    lead: 'E5 - G5 - A5 - - . B5 - A5 - G5 - E5 . D5 - E5 - G5 - - - . . . . . . ' +
          'E5 - G5 - A5 - - . C6 - B5 - A5 - G5 . A5 - - - - - - - . . . . . . . .',
    bass: 'A2 - . A2 E3 - . . F2 - . F2 C3 - . . G2 - . G2 D3 - . . E2 - . E2 B2 - . . ' +
          'A2 - . A2 E3 - . . F2 - . F2 C3 - . . G2 - . G2 D3 - . . A2 - - - . . . .',
    drums: 'k . h . s . h . k . h . s . h h k . h . s . h . k k h . s . h . ' +
           'k . h . s . h . k . h . s . h h k . h . s . h . k k h . s h s s'
  },
  paoz: {
    bpm: 132,
    lead: 'C5 D5 E5 G5 - E5 G5 A5 G5 - E5 - D5 - C5 . D5 E5 D5 C5 A4 - C5 - D5 - - - . . . . ' +
          'C5 D5 E5 G5 - E5 G5 A5 C6 - A5 - G5 - E5 . D5 E5 G5 E5 D5 - C5 - C5 - - - . . . .',
    bass: 'C3 . G3 . C3 . G3 . F2 . C3 . F2 . C3 . A2 . E3 . A2 . E3 . G2 . D3 . G2 . D3 . ' +
          'C3 . G3 . C3 . G3 . F2 . C3 . F2 . C3 . G2 . D3 . G2 . D3 . C3 . G2 . C3 - - .',
    drums: 'k . h k s . h . k . h k s . h h k . h k s . h . k k h . s h s .'
  },
  kame: {
    bpm: 108,
    lead: 'G4 - B4 D5 - B4 C5 - A4 - - . E5 - D5 - C5 - B4 - A4 - B4 - G4 - - - . . . . ' +
          'G4 - B4 D5 - B4 E5 - D5 - - . G5 - F#5 - E5 - D5 - C5 - B4 - A4 - - - G4 - - .',
    bass: 'G2 . . G2 D3 . . . C3 . . C3 G2 . . . E2 . . E2 B2 . . . D3 . . D3 A2 . . . ' +
          'G2 . . G2 D3 . . . C3 . . C3 G2 . . . A2 . . A2 E3 . . . D3 . . D3 G2 . . .',
    drums: 'k . . h s . h . k . . h s . h . k . . h s . h . k . h h s . h h'
  },
  capsule: {
    bpm: 140,
    lead: 'A4 C5 E5 A5 E5 C5 A4 C5 G4 B4 D5 G5 D5 B4 G4 B4 F4 A4 C5 F5 C5 A4 F4 A4 E4 G#4 B4 E5 B4 G#4 E4 - ' +
          'A5 - E5 - C6 - B5 A5 G5 - D5 - B5 - A5 G5 F5 - C5 - A5 - G5 F5 E5 - - - . . . .',
    bass: 'A2 A2 . A2 A3 . A2 . G2 G2 . G2 G3 . G2 . F2 F2 . F2 F3 . F2 . E2 E2 . E2 E3 . E2 .',
    drums: 'k h s h k h s h k h s h k k s h k h s h k h s h k h s h k s s s'
  },
  karin: {
    bpm: 84,
    lead: 'D5 - - - A4 - - - F5 - E5 - D5 - - - C5 - - - A4 - - - D5 - - - - - . . ' +
          'D5 - - - A4 - - - G5 - F5 - E5 - - - F5 - E5 - C5 - - - D5 - - - - - . .',
    bass: 'D3 - - - A2 - - - D3 - - - A2 - - - C3 - - - G2 - - - D3 - - - A2 - - -',
    drums: 'k . . . h . . . s . . . h . . . k . . . h . . . s . . . h . h .'
  },
  batalla: {
    bpm: 164,
    lead: 'E5 E5 . E5 . C5 E5 . G5 - - . G4 - - . C5 - . G4 - . E4 - . A4 . B4 . A#4 A4 . ' +
          'G4 E5 G5 A5 . F5 G5 . E5 . C5 D5 B4 - . . C5 - . G4 - . E4 - . A4 . B4 . C5 - - .',
    bass: 'C3 C3 . C3 G2 G2 . G2 A2 A2 . A2 E2 E2 . E2 F2 F2 . F2 C3 C3 . C3 G2 G2 . G2 G2 G2 . .',
    drums: 'k h s h k k s h k h s h k k s s'
  },
  victoria: {
    bpm: 150,
    once: true,
    lead: 'C5 E5 G5 C6 - - G5 C6 - - - - . . . .',
    bass: 'C3 . G2 . C3 . G2 . C3 - - - . . . .',
    drums: 'k . s . k . s . k . . . . . . .'
  }
}
