<template>
  <div v-if="game.dialog" class="dialog-wrap" @click="onTap">
    <div class="dialog card">
      <b class="who">{{ line?.who }}</b>
      <p>{{ shown }}<span class="caret">▼</span></p>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useGameStore } from '../stores/game.js'

const game = useGameStore()
const line = computed(() => game.dialog?.lines[game.dialog.index])
// efecto máquina de escribir; tocar completa el texto antes de avanzar
const shown = ref('')
let iv
watch(line, l => {
  clearInterval(iv)
  if (!l) return
  shown.value = ''
  let i = 0
  iv = setInterval(() => {
    shown.value = l.text.slice(0, ++i)
    if (i >= l.text.length) clearInterval(iv)
  }, 22)
}, { immediate: true })

function onTap () {
  if (shown.value.length < line.value.text.length) {
    clearInterval(iv)
    shown.value = line.value.text
    return
  }
  game.nextLine()
}
</script>

<style scoped>
.dialog-wrap { position: fixed; inset: 0; z-index: 30; display: flex; align-items: flex-end; padding: 12px 12px calc(env(safe-area-inset-bottom) + 12px); }
.dialog { width: 100%; max-width: 520px; margin: 0 auto; min-height: 96px; }
.who { color: var(--yellow); font-size: 10px; }
p { font-size: 11px; line-height: 1.7; margin: 8px 0 0; }
.caret { margin-left: 6px; animation: blink .6s steps(2) infinite; }
@keyframes blink { 50% { opacity: 0; } }
</style>
