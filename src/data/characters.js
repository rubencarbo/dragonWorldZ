// Sprites pixel-art provisionales (se sustituirán por las imágenes oficiales que
// se procesan desde el panel Admin → Sprites). Cada sprite es una rejilla de
// caracteres; cada carácter se mapea a un color de PALETTE y '.' es transparente.
// El motor los extruye a vóxeles para darles volumen 3D con estética 8 bits.

export const PALETTE = {
  k: '#15151f', // pelo negro
  s: '#f6c38e', // piel
  e: '#1d1d2b', // ojos
  m: '#b4533c', // boca
  o: '#f47b20', // naranja gi
  b: '#2250b8', // azul
  u: '#5fc9d8', // turquesa (pelo Bulma)
  w: '#f4f4f4', // blanco
  y: '#f6d33c', // amarillo
  r: '#d6333a', // rojo
  g: '#46a546', // verde
  d: '#2f6e2f', // verde oscuro
  n: '#7c4a22', // marrón
  p: '#f29ec0', // rosa
  x: '#9a9aa8', // gris
  v: '#7a4bb0', // morado
  c: '#e0e0e8'  // gris claro
}

export const CHARACTERS = {
  goku: {
    name: 'Son Goku',
    color: '#f47b20',
    grid: [
      '..k..kk..k..',
      '.kkkkkkkkkk.',
      'kkkkkkkkkkkk',
      'kksssssssskk',
      '.ksesssseks.',
      '..ssssssss..',
      '...ssmmss...',
      '..oobbbboo..',
      'sooobbbbooos',
      'soooooooooos',
      's.oooooooo.s',
      '..bbbbbbbb..',
      '..oooooooo..',
      '..ooo..ooo..',
      '..bbb..bbb..',
      '.bbbb..bbbb.'
    ]
  },
  krilin: {
    name: 'Krilin',
    color: '#f47b20',
    grid: [
      '............',
      '...ssssss...',
      '..se.ss.es..',
      '..ssssssss..',
      '..sesssses..',
      '..ssssssss..',
      '...ssmmss...',
      '..oobbbboo..',
      'sooobbbbooos',
      'soooooooooos',
      's.oooooooo.s',
      '..bbbbbbbb..',
      '..oooooooo..',
      '..ooo..ooo..',
      '..bbb..bbb..',
      '.bbbb..bbbb.'
    ]
  },
  bulma: {
    name: 'Bulma',
    color: '#5fc9d8',
    grid: [
      '...uuuuuu...',
      '..uuuuuuuu..',
      '.uuuuuuuuuu.',
      '.uussssssuu.',
      '.usesssseus.',
      '.uussssssuu.',
      '.uu.smms.uu.',
      '..pppppppp..',
      'spppppppppps',
      'sppppwwpppps',
      's.pppppppp.s',
      '..pppppppp..',
      '...ssssss...',
      '...ss..ss...',
      '...ss..ss...',
      '..rrr..rrr..'
    ]
  },
  roshi: {
    name: 'Maestro Roshi',
    color: '#f4f4f4',
    grid: [
      '............',
      '...ssssss...',
      '..ssssssss..',
      '..skkkkkks..',
      '..skk.skks..',
      '..ssssssss..',
      '..wwwwwwww..',
      '.wwwwwwwwww.',
      'ssowwwwwwoss',
      'soowwwwwwoos',
      's.ooowwooo.s',
      '..oooooooo..',
      '..oooooooo..',
      '..ooo..ooo..',
      '..nnn..nnn..',
      '.nnnn..nnnn.'
    ]
  },
  karin: {
    name: 'Karin',
    color: '#f4f4f4',
    grid: [
      '..w......w..',
      '..ww....ww..',
      '..wwwwwwww..',
      '.wwwwwwwwww.',
      '.wweawwaeww.',
      '.wwwwppwwww.',
      '.wwxwwwwxww.',
      '..wwwwwwww..',
      '.nwwwwwwww..',
      '.nwwwxxwww..',
      '.nwwwwwwww..',
      '.nwwwwwwww..',
      '.n.wwwwww...',
      '.n.www.www..',
      '.n.www.www..',
      '.n.........'
    ].map(r => r.replace(/a/g, 'y').padEnd(12, '.'))
  },
  oolong: {
    name: 'Oolong',
    color: '#f29ec0',
    grid: [
      '............',
      '..p......p..',
      '..pp....pp..',
      '..pppppppp..',
      '.pppppppppp.',
      '.ppeppppepp.',
      '.pppprrpppp.',
      '..pprrrrpp..',
      '..gggggggg..',
      '.pggggggggp.',
      '.pggggggggp.',
      '..gggggggg..',
      '..bbbbbbbb..',
      '..bbb..bbb..',
      '..ppp..ppp..',
      '..nnn..nnn..'
    ]
  },
  dino: {
    name: 'Dinosaurio glotón',
    color: '#46a546',
    grid: [
      '....gggggg....',
      '...ggggggggg..',
      '...gewggggggg.',
      '...ggggggggggg',
      '...gggggggwwww',
      '...ggggggg....',
      '..gggggggg....',
      '.ggyyyyyggg...',
      'gggyyyyyyggg..',
      'g.gyyyyyygg.g.',
      '..gyyyyyygg...',
      '..ggggggggg...',
      '..ggg...ggg...',
      '..ggg...ggg...',
      '.dddd..dddd...',
      '..............'
    ]
  },
  chichi: {
    name: 'Chichí',
    color: '#7a4bb0',
    grid: [
      '....kkkk....',
      '...kkkkkk...',
      '..kkkkkkkk..',
      '..kssssssk..',
      '..sesssses..',
      '..ssssssss..',
      '...ssmmss...',
      '..vvvvvvvv..',
      'svvvvyyvvvvs',
      'svvvvvvvvvvs',
      's.vvvvvvvv.s',
      '..vvvvvvvv..',
      '..vvvvvvvv..',
      '...ss..ss...',
      '...ss..ss...',
      '..nnn..nnn..'
    ]
  }
}
