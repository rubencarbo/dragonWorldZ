// Mapas de cada lugar. Cada carácter es una casilla (ver TILES).
// Los "props" son objetos/personajes fijos del lugar; las misiones pueden
// añadir más mediante "spawns" (ver missions.js).

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
