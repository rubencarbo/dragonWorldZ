<template>
  <div class="mg">
    <p class="score">Nivel {{ seq.length }}/{{ target }} · Vidas {{ '❤'.repeat(lives) }}</p>
    <p class="tell">{{ showing ? 'Observa la secuencia de ki...' : 'Tu turno: repítela' }}</p>
    <div class="pads">
      <button v-for="(p, i) in PADS" :key="p.name" class="pad" :style="{ background: p.color }"
        :class="{ lit: lit === i }" :disabled="showing" @click="press(i)">{{ p.name }}</button>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { chiptune, noteToFreq } from '../engine/chiptune.js'

const props = defineProps({ config: Object, enemy: Object })
const emit = defineEmits(['end'])
const PADS = [
  { name: 'ROJO', color: '#d6333a', note: 'C5' },
  { name: 'AZUL', color: '#2250b8', note: 'E5' },
  { name: 'AMARILLO', color: '#e0b020', note: 'G5' },
  { name: 'VERDE', color: '#2f9e44', note: 'C6' }
]
const target = props.config?.length || 6
const seq = ref([])
const input = ref([])
const lit = ref(-1)
const showing = ref(true)
const lives = ref(2)

const wait = ms => new Promise(r => setTimeout(r, ms))
function beep (i) {
  if (chiptune.ensure()) chiptune.tone('pulse', noteToFreq(PADS[i].note), chiptune.ctx.currentTime, 0.2, 0.2)
}

async function show () {
  showing.value = true
  input.value = []
  await wait(500)
  const speed = Math.max(220, 520 - seq.value.length * 40)
  for (const i of seq.value) {
    lit.value = i
    beep(i)
    await wait(speed)
    lit.value = -1
    await wait(120)
  }
  showing.value = false
}

function grow () {
  seq.value.push(Math.floor(Math.random() * 4))
  show()
}

function press (i) {
  lit.value = i
  beep(i)
  setTimeout(() => { if (lit.value === i) lit.value = -1 }, 150)
  input.value.push(i)
  const k = input.value.length - 1
  if (seq.value[k] !== i) {
    chiptune.sfx('bad')
    lives.value--
    if (lives.value <= 0) { showing.value = true; setTimeout(() => emit('end', false), 600); return }
    show()
    return
  }
  if (input.value.length === seq.value.length) {
    chiptune.sfx('ok')
    if (seq.value.length >= target) { showing.value = true; setTimeout(() => emit('end', true), 600); return }
    setTimeout(grow, 400)
  }
}

onMounted(() => { seq.value = [0, 1, 2].map(() => Math.floor(Math.random() * 4)); show() })
</script>

<style scoped>
.pads { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; max-width: 280px; margin: 0 auto; }
.pad { height: 90px; border: 4px solid #111; color: #fff; font-family: inherit; font-size: 9px; opacity: .55; box-shadow: 4px 4px 0 #000; }
.pad.lit { opacity: 1; filter: brightness(1.5); transform: translate(2px, 2px); box-shadow: 2px 2px 0 #000; }
</style>
