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
