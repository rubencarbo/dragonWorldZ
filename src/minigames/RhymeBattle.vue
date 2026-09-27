<template>
  <div class="mg">
    <p class="score">Ronda {{ round + 1 }}/{{ total }} · Aciertos {{ hits }}</p>
    <div class="timer"><div :style="{ width: (left / seconds * 100) + '%' }" /></div>
    <p class="say">«{{ current.word.toUpperCase() }}...»</p>
    <p class="tell">¿Qué palabra rima?</p>
    <div class="options">
      <button v-for="o in current.options" :key="o" class="btn" :disabled="answered"
        :class="{ good: answered && o === current.answer, bad: answered && o === picked && o !== current.answer }"
        @click="answer(o)">{{ o }}</button>
    </div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, ref } from 'vue'
import { chiptune } from '../engine/chiptune.js'
import { makeRhymeRound, RHYMES } from './logic.js'

const props = defineProps({ config: Object, enemy: Object })
const emit = defineEmits(['end'])
const total = props.config?.rounds || 5
const seconds = props.config?.seconds || 8
const offset = Math.floor(Math.random() * RHYMES.length)
const round = ref(0)
const hits = ref(0)
const current = ref(makeRhymeRound(offset))
const answered = ref(false)
const picked = ref(null)
const left = ref(seconds)

const iv = setInterval(() => {
  if (answered.value) return
  left.value = Math.max(0, left.value - 0.1)
  if (left.value <= 0) answer(null)
}, 100)
onBeforeUnmount(() => clearInterval(iv))

function answer (o) {
  answered.value = true
  picked.value = o
  if (o === current.value.answer) { hits.value++; chiptune.sfx('ok') } else chiptune.sfx('bad')
  setTimeout(() => {
    if (round.value + 1 >= total) {
      clearInterval(iv)
      emit('end', hits.value >= Math.ceil(total * 0.6))
      return
    }
    round.value++
    current.value = makeRhymeRound(offset + round.value)
    answered.value = false
    picked.value = null
    left.value = seconds
  }, 800)
}
</script>

<style scoped>
.say { font-size: 18px; color: var(--yellow); text-align: center; margin: 10px 0; }
.options { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.timer { height: 8px; border: 2px solid #fff; }
.timer div { height: 100%; background: var(--orange); transition: width .1s linear; }
.good { background: #46a546 !important; }
.bad { background: #d6333a !important; }
</style>
