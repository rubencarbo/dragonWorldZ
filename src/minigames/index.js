import RockPaperScissors from './RockPaperScissors.vue'
import TicTacToe from './TicTacToe.vue'
import RhymeBattle from './RhymeBattle.vue'
import KiSequence from './KiSequence.vue'
import ShellGame from './ShellGame.vue'

// Registro de minijuegos de combate. Para añadir uno nuevo: crea el componente
// (props: config, enemy · emite 'end' con true/false) y regístralo aquí.
export const MINIGAMES = {
  rps: { name: 'Jan-Ken (piedra, papel o tijera)', component: RockPaperScissors, help: 'Lee la pista del rival y gana al mejor de N.' },
  tictactoe: { name: 'Tres en raya', component: TicTacToe, help: 'Consigue tres ⭕ en línea.' },
  rhyme: { name: 'Duelo de rimas', component: RhymeBattle, help: 'Elige la palabra que rima antes de que acabe el tiempo.' },
  kiseq: { name: 'Secuencia de ki', component: KiSequence, help: 'Repite la secuencia de colores. Cada vez es más larga.' },
  shell: { name: 'Sigue la jarra', component: ShellGame, help: 'Vigila dónde queda el agua ultrasagrada.' }
}
