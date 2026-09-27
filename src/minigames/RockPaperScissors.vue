<template>
  <div class="mg">
    <p class="score">Tú {{ me }} — {{ them }} {{ enemy.name }}</p>
    <p class="tell">{{ tell }}</p>
    <div class="reveal" v-if="last">
      <span>{{ ICON[last.mine] }}</span><small>vs</small><span>{{ ICON[last.theirs] }}</span>
      <b :class="last.result">{{ RESULT[last.result] }}</b>
    </div>
    <div class="choices">
      <button v-for="c in MOVES" :key="c" class="btn big" :disabled="done" @click="play(c)">
        {{ ICON[c] }}<small>{{ NAME[c] }}</small>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { chiptune } from '../engine/chiptune.js'
import { rpsWinner, rpsEnemyMove } from './logic.js'

const props = defineProps({ config: Object, enemy: Object })
const emit = defineEmits(['end'])
const MOVES = ['piedra', 'papel', 'tijera']
const ICON = { piedra: '✊', papel: '✋', tijera: '✌️' }
const NAME = { piedra: 'Piedra', papel: 'Papel', tijera: 'Tijera' }
const RESULT = { win: '¡GANAS!', lose: 'PIERDES', draw: 'EMPATE' }
// "Tells": pistas de lo que va a sacar el rival (aciertan casi siempre)
const TELLS = {
  piedra: 'Aprieta las garras con fuerza...',
  papel: 'Abre mucho la boca, como para tragarse algo...',
  tijera: 'Mueve dos dedos, chac, chac...'
}

const need = Math.ceil((props.config?.bestOf || 3) / 2)
const me = ref(0)
const them = ref(0)
const last = ref(null)
const done = ref(false)
const history = []
let planned = rpsEnemyMove(history)
const tell = ref(TELLS[planned])

function play (mine) {
  const theirs = planned
  const result = rpsWinner(mine, theirs)
  history.push(mine)
  last.value = { mine, theirs, result }
  if (result === 'win') { me.value++; chiptune.sfx('ok') }
  if (result === 'lose') { them.value++; chiptune.sfx('bad') }
  if (me.value >= need || them.value >= need) {
    done.value = true
    setTimeout(() => emit('end', me.value >= need), 900)
    return
  }
  planned = rpsEnemyMove(history)
  // 80% de las veces la pista es fiable
  const shown = Math.random() < 0.8 ? planned : MOVES[Math.floor(Math.random() * 3)]
  tell.value = TELLS[shown]
}
</script>
