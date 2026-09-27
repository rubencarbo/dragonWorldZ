<template>
  <div class="mg">
    <p class="score">Tú: ⭕ · {{ enemy.name }}: ❌ · {{ wins }}/{{ need }}</p>
    <p class="tell">{{ msg }}</p>
    <div class="board">
      <button v-for="(c, i) in board" :key="i" class="cell" :class="{ win: winLine.includes(i) }"
        :disabled="!!c || locked" @click="play(i)">{{ c === 'O' ? '⭕' : c === 'X' ? '❌' : '' }}</button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { chiptune } from '../engine/chiptune.js'
import { LINES, tttAiMove, tttWinner } from './logic.js'

const props = defineProps({ config: Object, enemy: Object })
const emit = defineEmits(['end'])
const need = props.config?.wins || 1
const level = props.config?.level || 'normal'
const board = ref(Array(9).fill(null))
const locked = ref(false)
const wins = ref(0)
const losses = ref(0)
const msg = ref('Empiezas tú. Tres en línea y ganas.')
const winLine = ref([])

function finishRound (w) {
  locked.value = true
  winLine.value = LINES.find(l => l.every(i => board.value[i] === w)) || []
  if (w === 'O') { wins.value++; chiptune.sfx('ok'); msg.value = '¡Tres en raya!' }
  else if (w === 'X') { losses.value++; chiptune.sfx('bad'); msg.value = `${props.enemy.name} gana esta.` }
  else msg.value = 'Empate... ¡otra!'
  setTimeout(() => {
    if (wins.value >= need) return emit('end', true)
    if (losses.value >= need) return emit('end', false)
    board.value = Array(9).fill(null)
    winLine.value = []
    locked.value = false
    // tras perder o empatar, a veces empieza el rival
    if (w !== 'O' && Math.random() < 0.5) aiTurn()
  }, 1100)
}

function aiTurn () {
  const i = tttAiMove(board.value, 'X', level)
  board.value[i] = 'X'
  const w = tttWinner(board.value)
  if (w) finishRound(w)
}

function play (i) {
  board.value[i] = 'O'
  chiptune.sfx('step')
  let w = tttWinner(board.value)
  if (w) return finishRound(w)
  locked.value = true
  setTimeout(() => {
    locked.value = false
    aiTurn()
  }, 350)
}
</script>

<style scoped>
.board { display: grid; grid-template-columns: repeat(3, 72px); gap: 6px; justify-content: center; }
.cell { width: 72px; height: 72px; font-size: 32px; background: #1c1c44; border: 3px solid #fff; color: #fff; }
.cell.win { background: #f6d33c; }
</style>
