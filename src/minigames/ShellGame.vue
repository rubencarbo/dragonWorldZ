<template>
  <div class="mg">
    <p class="score">Ronda {{ round + 1 }}/{{ total }} · Aciertos {{ hits }}</p>
    <p class="tell">{{ msg }}</p>
    <div class="table">
      <button v-for="j in 3" :key="j" class="jar" :style="{ left: slotLeft(posOf[j - 1]) }"
        :class="{ lift: reveal && (j - 1) === prize || reveal && (j - 1) === pickedJar }"
        :disabled="phase !== 'pick'" @click="pick(j - 1)">
        <span class="pot">🏺</span>
        <span v-if="reveal && (j - 1) === prize" class="water">💧</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { chiptune } from '../engine/chiptune.js'
import { randomSwaps } from './logic.js'

const props = defineProps({ config: Object, enemy: Object })
const emit = defineEmits(['end'])
const total = props.config?.rounds || 3
const baseSwaps = props.config?.swaps || 6
const round = ref(0)
const hits = ref(0)
const prize = ref(0) // índice de jarra (objeto) que tiene el agua
const posOf = ref([0, 1, 2]) // posición (hueco) de cada jarra
const phase = ref('show')
const reveal = ref(true)
const pickedJar = ref(-1)
const msg = ref('El agua está en esta jarra...')
const slotLeft = s => `calc(${s * 33.3}% + 4px)`
const wait = ms => new Promise(r => setTimeout(r, ms))

async function playRound () {
  phase.value = 'show'
  reveal.value = true
  pickedJar.value = -1
  prize.value = Math.floor(Math.random() * 3)
  msg.value = 'El agua ultrasagrada está aquí. ¡No la pierdas de vista!'
  await wait(1300)
  reveal.value = false
  await wait(400)
  msg.value = 'Karin mueve las jarras...'
  const swaps = randomSwaps(baseSwaps + round.value * 2)
  const speed = Math.max(180, 420 - round.value * 90)
  for (const [a, b] of swaps) {
    // a y b son huecos: intercambia las jarras que los ocupan
    const p = [...posOf.value]
    const ja = p.indexOf(a)
    const jb = p.indexOf(b)
    p[ja] = b
    p[jb] = a
    posOf.value = p
    chiptune.sfx('step')
    await wait(speed)
  }
  phase.value = 'pick'
  msg.value = '¿Dónde está el agua?'
}

async function pick (j) {
  phase.value = 'result'
  pickedJar.value = j
  reveal.value = true
  const ok = j === prize.value
  if (ok) { hits.value++; chiptune.sfx('ok'); msg.value = '¡Bien visto!' } else { chiptune.sfx('bad'); msg.value = '¡Fallaste!' }
  await wait(1200)
  if (round.value + 1 >= total) { emit('end', hits.value >= Math.ceil(total / 2 + 0.1)); return }
  round.value++
  playRound()
}

onMounted(playRound)
</script>

<style scoped>
.table { position: relative; height: 110px; margin: 10px auto; width: 100%; max-width: 300px; }
.jar {
  position: absolute; top: 30px; width: calc(33.3% - 8px); height: 70px; background: none; border: none;
  transition: left .18s steps(3), transform .2s; font-size: 44px; cursor: pointer;
}
.jar.lift { transform: translateY(-26px); }
.jar .water { position: absolute; left: 50%; bottom: -24px; transform: translateX(-50%); font-size: 20px; }
</style>
