<template>
  <div v-if="!started" class="title-screen" @click="start">
    <div class="logo">
      <span class="ball">★</span>
      <h1>DRAGON<br><b>WORLD Z</b></h1>
    </div>
    <p class="blink">{{ loading ? 'CARGANDO...' : 'TOCA PARA EMPEZAR' }}</p>
    <small>Fan game sin ánimo de lucro · prototipo</small>
  </div>
  <template v-else>
    <router-view :key="$route.fullPath" />
    <BattleHost />
    <DialogBox />
    <transition name="fade"><div v-if="game.toast" class="toast">{{ game.toast }}</div></transition>
  </template>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useGameStore } from './stores/game.js'
import { useMissionsStore } from './stores/missions.js'
import { useSpritesStore } from './stores/sprites.js'
import { useSettingsStore } from './stores/settings.js'
import { chiptune } from './engine/chiptune.js'
import BattleHost from './components/BattleHost.vue'
import DialogBox from './components/DialogBox.vue'

const game = useGameStore()
const route = useRoute()
const started = ref(false)
const loading = ref(true)

onMounted(async () => {
  await Promise.all([game.load(), useMissionsStore().load(), useSpritesStore().load()])
  loading.value = false
  // el panel admin no necesita pantalla de título
  if (location.hash.includes('/admin')) started.value = true
})

function start () {
  if (loading.value) return
  // el audio del navegador solo arranca tras un gesto del usuario
  chiptune.setVolume(useSettingsStore().music)
  chiptune.resume()
  started.value = true
  if (!game.progress.completed.length && !game.progress.active && route.name === 'globe') {
    game.say([
      { who: 'Narrador', text: 'Hace mucho tiempo, siete esferas mágicas fueron repartidas por el mundo...' },
      { who: 'Narrador', text: 'Quien las reúna podrá invocar al dragón Shenlong y pedirle un deseo.' },
      { who: 'Goku', text: '¡Hola! Soy Goku. Gira el mundo con el dedo y toca la Montaña Paoz, ¡mi casa!' }
    ])
  }
}
</script>
