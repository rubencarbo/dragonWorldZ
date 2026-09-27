// Misiones "semilla". Al arrancar se combinan con las publicadas desde el
// panel Admin (Firestore o localStorage), que pueden añadir misiones nuevas
// (packs DLC) o sobrescribir estas por id.
//
// Tipos de paso:
//   talk    → hablar con un prop/npc (target)
//   goto    → acercarse a un prop (target)
//   battle  → minijuego contra un rival (game: rps | tictactoe | rhyme | kiseq | shell)
//   collect → recoger un objeto (target) → se añade al inventario (item)
// "spawns" añade props al mapa mientras la misión está activa, entre los pasos
// fromStep y untilStep (incluidos).

export const SEED_MISSIONS = [
  {
    id: 'm_esfera4',
    pack: 'base',
    worldId: 'tierra',
    locationId: 'paoz',
    title: 'La esfera de cuatro estrellas',
    summary: 'El recuerdo más valioso del abuelo Gohan ha desaparecido del altar.',
    music: 'paoz',
    intro: [
      { who: 'Narrador', text: 'Montaña Paoz. Amanece. Un niño con cola se despierta con hambre de dinosaurio...' },
      { who: 'Goku', text: '¡Buenos días, abuelito! ...¿Eh? ¿Dónde está tu esfera?' }
    ],
    spawns: [
      { id: 'huellas', kind: 'footprints', x: 10, y: 8, name: 'Huellas gigantes', fromStep: 1 },
      { id: 'dino', kind: 'npc', sprite: 'dino', x: 11, y: 11, name: 'Dinosaurio glotón', fromStep: 2, untilStep: 2 },
      { id: 'esfera4', kind: 'ball', stars: 4, x: 10, y: 11, name: 'Esfera de 4 estrellas', fromStep: 3, untilStep: 3 }
    ],
    steps: [
      { type: 'talk', target: 'altar', hint: 'Mira el altar del abuelo.',
        lines: [
          { who: 'Goku', text: 'El cojín está vacío... ¡La esfera de cuatro estrellas no está!' },
          { who: 'Goku', text: 'Hay barro en el suelo. Algo muy grande ha pasado por aquí.' }
        ] },
      { type: 'goto', target: 'huellas', hint: 'Sigue el rastro hacia el río.',
        lines: [
          { who: 'Goku', text: 'Huellas de tres dedos... y huelen a pescado. ¡Un dinosaurio!' },
          { who: 'Goku', text: 'Van hacia las rocas del sureste.' }
        ] },
      { type: 'battle', target: 'dino', game: 'rps', config: { bestOf: 3 }, hint: 'Enfréntate al dinosaurio.',
        lines: [
          { who: 'Dinosaurio', text: '¡GROAAAR! (Se relame. Tiene algo brillante entre los dientes.)' },
          { who: 'Goku', text: '¡Devuélvemela! Te reto al Jan-Ken: ¡Piedra, papel o tijera!' }
        ],
        win: [{ who: 'Dinosaurio', text: '¡GROA...! ¡Achís! (La esfera sale disparada y rueda por la hierba.)' }],
        lose: [{ who: 'Dinosaurio', text: '¡GROAR! (Se ríe. Parece que quiere la revancha.)' }] },
      { type: 'collect', target: 'esfera4', item: 'esfera_4', hint: 'Recoge la esfera.',
        lines: [
          { who: 'Goku', text: '¡La tengo! Brilla como un sol pequeñito... Abuelito, ya estás en casa.' },
          { who: '???', text: '(A lo lejos, una chica de pelo turquesa mira un aparato que pita sin parar...)' }
        ] }
    ],
    reward: { zeni: 100, items: [], characters: [] }
  },
  {
    id: 'm_roshi_rimas',
    pack: 'base',
    worldId: 'tierra',
    locationId: 'kame',
    requires: ['m_esfera4'],
    title: 'Las rimas de la tortuga',
    summary: 'El Maestro Roshi solo entrena a quien sepa rimar... y traer buenas noticias.',
    music: 'kame',
    intro: [
      { who: 'Narrador', text: 'Una isla, una casa rosa y un anciano con gafas de sol que no deja de sonreír.' }
    ],
    steps: [
      { type: 'talk', target: 'roshi', hint: 'Habla con el Maestro Roshi.',
        lines: [
          { who: 'Roshi', text: '¿Quieres ser mi alumno? El cuerpo se entrena con leche y piedras...' },
          { who: 'Roshi', text: '...¡pero la mente se entrena con RIMAS! Si ganas, te enseño algo especial.' }
        ] },
      { type: 'battle', target: 'roshi', game: 'rhyme', config: { rounds: 5, seconds: 8 }, hint: 'Duelo de rimas con Roshi.',
        lines: [{ who: 'Roshi', text: 'Yo digo una palabra, tú eliges la que rima. ¡Rápido como una tortuga voladora!' }],
        win: [
          { who: 'Roshi', text: '¡Jo, jo! Tienes oído de campeón. Toma, Krilin entrenará contigo.' },
          { who: 'Krilin', text: 'Bueno... vale. ¡Pero el que pierda friega los platos!' }
        ],
        lose: [{ who: 'Roshi', text: 'Mmm... vuelve cuando hayas leído más. Poesía, digo.' }] }
    ],
    reward: { zeni: 150, items: [], characters: ['krilin'] }
  },
  {
    id: 'm_radar',
    pack: 'base',
    worldId: 'tierra',
    locationId: 'capsule',
    requires: ['m_roshi_rimas'],
    title: 'El radar del dragón',
    summary: 'Bulma necesita calibrar su radar... y alguien se ha llevado la pieza clave.',
    music: 'capsule',
    intro: [
      { who: 'Narrador', text: 'Capital del Oeste. Coches voladores, robots y un laboratorio con olor a café.' }
    ],
    steps: [
      { type: 'talk', target: 'bulma_npc', hint: 'Habla con Bulma.',
        lines: [
          { who: 'Bulma', text: '¿Tú eres el chico de la esfera de cuatro estrellas? ¡Mi radar se ha vuelto loco!' },
          { who: 'Bulma', text: 'Repite la secuencia de ki exactamente como la marque la pantalla. Sin fallar.' }
        ] },
      { type: 'battle', target: 'bulma_npc', game: 'kiseq', config: { length: 6 }, hint: 'Calibra el radar con Bulma.',
        lines: [{ who: 'Bulma', text: 'Rojo, azul, amarillo, verde... ¡Memoriza!' }],
        win: [{ who: 'Bulma', text: '¡Perfecto! Solo falta el chip... ¡OOLONG! ¡Devuélvelo!' }],
        lose: [{ who: 'Bulma', text: '¡Casi lo quemas! Venga, otra vez.' }] },
      { type: 'battle', target: 'oolong_npc', game: 'tictactoe', config: { level: 'normal' }, hint: 'Recupera el chip de Oolong.',
        lines: [
          { who: 'Oolong', text: '¿El chip? Te lo doy si me ganas al tres en raya. Me transformo en X, ¡y tú en O!' }
        ],
        win: [{ who: 'Oolong', text: 'Bah... toma tu chip. Pero me quedo con la nevera.' }],
        lose: [{ who: 'Oolong', text: '¡Ja! Los cerdos también somos listos.' }] }
    ],
    reward: { zeni: 200, items: ['radar'], characters: ['bulma'] }
  },
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
      { who: 'Narrador', text: 'Tras escalar sin descanso, Goku llega a la cima de la Torre Karin.' }
    ],
    spawns: [
      { id: 'senzu', kind: 'bean', x: 5, y: 2, name: 'Semilla del ermitaño', fromStep: 2, untilStep: 2 }
    ],
    steps: [
      { type: 'talk', target: 'karin_npc', hint: 'Habla con Karin.',
        lines: [
          { who: 'Karin', text: '¿Quieres el agua ultrasagrada? Esconderé la jarra entre tres. Sigue el movimiento.' }
        ] },
      { type: 'battle', target: 'karin_npc', game: 'shell', config: { rounds: 3, swaps: 6 }, hint: 'Sigue la jarra.',
        lines: [{ who: 'Karin', text: 'No parpadees. Ni siquiera tu cola puede seguirme.' }],
        win: [{ who: 'Karin', text: 'Bien visto. Como premio... una semilla del ermitaño. Está allí, junto al borde.' }],
        lose: [{ who: 'Karin', text: 'Demasiado lento. Tres años tardó el Maestro Roshi. ¡Otra vez!' }] },
      { type: 'collect', target: 'senzu', item: 'senzu', hint: 'Recoge la semilla.',
        lines: [{ who: 'Goku', text: 'Una judía pequeñita... ¡y me quita el hambre de golpe!' }] }
    ],
    reward: { zeni: 300, items: [], characters: [] }
  }
]
