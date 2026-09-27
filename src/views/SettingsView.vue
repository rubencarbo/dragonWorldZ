<template>
  <div class="page">
    <header class="page-head">
      <router-link to="/" class="btn small">◀ Volver</router-link>
      <h1>Ajustes</h1>
    </header>

    <section class="card">
      <h2>Modo de avance</h2>
      <label class="opt">
        <input type="radio" value="free" :checked="settings.moveMode === 'free'" @change="settings.update({ moveMode: 'free' })" />
        <span><b>🕊 Avance libre</b><small>Toca donde quieras ir y el personaje camina (o vuela) hasta allí.</small></span>
      </label>
      <label class="opt">
        <input type="radio" value="dice" :checked="settings.moveMode === 'dice'" @change="settings.update({ moveMode: 'dice' })" />
        <span><b>🎲 Avance con dados</b><small>Tira el dado y avanza esas casillas, en el globo y dentro de cada lugar. Hay casillas-evento por el camino.</small></span>
      </label>
    </section>

    <section class="card">
      <h2>Imagen y sonido</h2>
      <label class="row">Píxeles (estilo 8 bits)
        <select :value="settings.pixelScale" @change="settings.update({ pixelScale: Number($event.target.value) })">
          <option :value="2">Fino</option>
          <option :value="3">Retro</option>
          <option :value="4">Muy retro</option>
        </select>
      </label>
      <label class="row">Música
        <input type="range" min="0" max="1" step="0.1" :value="settings.music" @input="settings.update({ music: Number($event.target.value) })" />
      </label>
    </section>

    <section class="card">
      <h2>Partida</h2>
      <p class="muted">Guardado {{ firebaseEnabled ? 'en la nube (Firebase)' : 'en este dispositivo' }}.</p>
      <button class="btn danger" @click="reset">Borrar progreso</button>
      <router-link to="/admin" class="btn">🛠 Panel Admin</router-link>
    </section>
  </div>
</template>

<script setup>
import { useSettingsStore } from '../stores/settings.js'
import { useGameStore } from '../stores/game.js'
import { firebaseEnabled } from '../firebase/index.js'

const settings = useSettingsStore()
const game = useGameStore()
function reset () {
  if (confirm('¿Seguro? Se perderá todo el progreso.')) game.reset()
}
</script>

<style scoped>
.opt { display: flex; gap: 10px; align-items: flex-start; margin: 10px 0; cursor: pointer; }
.opt span { display: flex; flex-direction: column; gap: 4px; font-size: 10px; }
.opt small { opacity: .8; line-height: 1.6; font-size: 8px; }
.row { display: flex; justify-content: space-between; align-items: center; gap: 10px; font-size: 10px; margin: 10px 0; }
</style>
