<template>
  <div v-if="game.battle" class="overlay">
    <div class="battle card">
      <header>
        <span class="vs">{{ hero }} <b>VS</b> {{ game.battle.enemy.name }}</span>
        <small>{{ info?.name }}</small>
      </header>
      <p class="help">{{ info?.help }}</p>
      <component :is="info?.component" v-if="info" :config="game.battle.step.config || {}" :enemy="game.battle.enemy"
        @end="end" />
      <p v-else>Minijuego desconocido: {{ game.battle.step.game }}</p>
      <button class="btn small flee" @click="end(false)">Huir</button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useGameStore } from '../stores/game.js'
import { MINIGAMES } from '../minigames/index.js'
import { MAPS } from '../data/maps.js'
import { CHARACTERS } from '../data/characters.js'

const game = useGameStore()
const route = useRoute()
const info = computed(() => MINIGAMES[game.battle?.step.game])
const hero = computed(() => CHARACTERS[game.progress.character]?.name || 'Goku')

function end (won) {
  game.finishBattle(won, MAPS[route.params.id]?.music || 'globo')
}
</script>

<style scoped>
.overlay { position: fixed; inset: 0; background: #000b; display: grid; place-items: center; z-index: 20; padding: 12px; }
.battle { width: 100%; max-width: 420px; position: relative; animation: flash .3s steps(3); }
header { display: flex; flex-direction: column; gap: 4px; margin-bottom: 6px; }
.vs { font-size: 11px; }
.vs b { color: var(--red); margin: 0 6px; }
header small { color: var(--yellow); font-size: 8px; }
.help { font-size: 8px; opacity: .8; line-height: 1.6; }
.flee { margin-top: 12px; opacity: .7; }
@keyframes flash { 0% { filter: invert(1); } 100% { filter: none; } }
</style>
