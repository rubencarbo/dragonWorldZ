<template>
  <div class="page admin">
    <header class="page-head">
      <router-link to="/" class="btn small">◀ Juego</router-link>
      <h1>Panel Admin</h1>
    </header>

    <p v-if="firebaseEnabled" class="muted">
      Modo Firebase: publicar requiere una cuenta con el claim <code>admin</code>.
      <template v-if="user">Sesión: {{ user.email || 'anónima' }}</template>
      <button v-if="!user || user.isAnonymous" class="btn small" @click="login">Entrar con Google</button>
    </p>
    <p v-else class="muted">Modo local: los cambios se guardan en este navegador (configura Firebase en <code>.env.local</code> para publicarlos a todos los jugadores).</p>

    <nav class="tabs">
      <button class="chip" :class="{ on: tab === 'missions' }" @click="tab = 'missions'">Misiones (DLC)</button>
      <button class="chip" :class="{ on: tab === 'sprites' }" @click="tab = 'sprites'">Sprites</button>
    </nav>

    <!-- ===================== MISIONES ===================== -->
    <section v-if="tab === 'missions'" class="grid">
      <aside class="card list">
        <div class="list-actions">
          <button class="btn small primary" @click="newMission">＋ Nueva</button>
          <button class="btn small" @click="exportPack">⬇ Exportar</button>
          <button class="btn small" @click="importOpen = !importOpen">⬆ Importar</button>
        </div>
        <div v-if="importOpen" class="import">
          <textarea v-model="importText" placeholder="Pega aquí un array JSON de misiones (pack DLC)" />
          <button class="btn small primary" @click="importPack">Importar pack</button>
        </div>
        <div v-for="(group, pack) in byPack" :key="pack" class="pack">
          <h3>📦 {{ pack }}</h3>
          <button v-for="m in group" :key="m.id" class="item" :class="{ on: m.id === editingId }" @click="edit(m)">
            <span>{{ m.title }}</span>
            <small>
              {{ m.locationId }}
              <em v-if="missions.isSeed(m.id) && !isPublished(m.id)">base</em>
              <em v-else-if="missions.isSeed(m.id)" class="mod">modificada</em>
              <em v-else class="dlc">DLC</em>
              <em v-if="m.enabled === false" class="off">off</em>
            </small>
          </button>
        </div>
      </aside>

      <div v-if="draft !== null" class="card editor">
        <div class="editor-head">
          <b>{{ editingId || 'Nueva misión' }}</b>
          <div class="list-actions">
            <button class="btn small" @click="validate">✔ Validar</button>
            <button class="btn small primary" @click="publish">🚀 Publicar</button>
            <button v-if="isPublished(editingId)" class="btn small danger" @click="remove">
              {{ missions.isSeed(editingId) ? '↺ Restaurar original' : '🗑 Eliminar' }}
            </button>
          </div>
        </div>
        <textarea v-model="draft" class="json" spellcheck="false" />
        <ul v-if="errors.length" class="errors"><li v-for="e in errors" :key="e">⚠ {{ e }}</li></ul>
        <p v-else-if="okMsg" class="ok">{{ okMsg }}</p>

        <details class="help" open>
          <summary>Referencia rápida</summary>
          <p><b>Lugares con mapa:</b> {{ Object.keys(MAPS).join(', ') }}</p>
          <p v-if="helpMap"><b>Props en «{{ helpLoc }}»:</b> {{ helpMap.props.map(p => p.id).join(', ') }}</p>
          <p><b>Minijuegos (step.game):</b> {{ Object.keys(MINIGAMES).join(', ') }}</p>
          <p><b>Pasos:</b> talk · goto · battle · collect. Usa <code>spawns</code> para añadir NPCs/objetos al mapa entre <code>fromStep</code> y <code>untilStep</code>.</p>
          <p><b>Sprites de NPC:</b> {{ Object.keys(CHARACTERS).join(', ') }} · <b>kinds:</b> npc, ball, cabin, altar, sign, kamehouse, palm, dome, crate, jar, pillar, footprints, bean</p>
          <p><b>Música:</b> {{ Object.keys(TRACKS).join(', ') }}</p>
        </details>
      </div>
    </section>

    <!-- ===================== SPRITES ===================== -->
    <section v-else class="card sprites">
      <p class="muted">Sube la imagen de un personaje (PNG con fondo transparente, idealmente de frente). Se reduce a pixel-art con paleta limitada y se extruye a vóxeles 3D en el juego.</p>
      <div class="row">
        <label>Personaje
          <select v-model="spriteId">
            <option v-for="(c, id) in CHARACTERS" :key="id" :value="id">{{ c.name }}</option>
          </select>
        </label>
        <label>Altura (px) {{ spriteSize }}
          <input v-model.number="spriteSize" type="range" min="12" max="40" @input="process" />
        </label>
        <label>Colores {{ spriteColors }}
          <input v-model.number="spriteColors" type="range" min="4" max="16" @input="process" />
        </label>
      </div>
      <input type="file" accept="image/*" @change="loadImage" />
      <div class="previews">
        <div>
          <small>Actual</small>
          <canvas ref="currentCanvas" class="pix" />
        </div>
        <div v-if="spriteResult">
          <small>Nuevo</small>
          <canvas ref="newCanvas" class="pix" />
        </div>
      </div>
      <div class="list-actions">
        <button class="btn primary" :disabled="!spriteResult" @click="saveSprite">Guardar sprite</button>
        <button v-if="sprites.custom[spriteId]" class="btn danger" @click="sprites.remove(spriteId).then(drawCurrent)">Volver al provisional</button>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useMissionsStore } from '../stores/missions.js'
import { useSpritesStore } from '../stores/sprites.js'
import { MAPS } from '../data/maps.js'
import { CHARACTERS, PALETTE } from '../data/characters.js'
import { TRACKS } from '../data/music.js'
import { MINIGAMES } from '../minigames/index.js'
import { validateMission } from '../engine/missionLogic.js'
import { imageToGrid } from '../engine/voxel.js'
import { auth, firebaseEnabled } from '../firebase/index.js'

const missions = useMissionsStore()
const sprites = useSpritesStore()
const tab = ref('missions')

// ---------- Auth (solo Firebase) ----------
const user = ref(auth?.currentUser || null)
auth?.onAuthStateChanged(u => { user.value = u })
async function login () {
  const { GoogleAuthProvider, signInWithPopup } = await import('firebase/auth')
  await signInWithPopup(auth, new GoogleAuthProvider())
}

// ---------- Misiones ----------
const editingId = ref(null)
const draft = ref(null)
const errors = ref([])
const okMsg = ref('')
const importOpen = ref(false)
const importText = ref('')

const byPack = computed(() => {
  const g = {}
  for (const m of missions.all) (g[m.pack || 'sin pack'] ||= []).push(m)
  return g
})
const isPublished = id => missions.published.some(m => m.id === id)
const parsed = computed(() => { try { return JSON.parse(draft.value) } catch { return null } })
const helpLoc = computed(() => parsed.value?.locationId)
const helpMap = computed(() => MAPS[helpLoc.value])

const TEMPLATE = {
  id: 'dlc_nueva_mision',
  pack: 'dlc-1',
  enabled: true,
  worldId: 'tierra',
  locationId: 'paoz',
  requires: [],
  title: 'Nueva misión',
  summary: 'Descripción corta.',
  music: 'paoz',
  intro: [{ who: 'Narrador', text: 'Érase una vez...' }],
  spawns: [{ id: 'rival', kind: 'npc', sprite: 'oolong', x: 8, y: 6, name: 'Oolong', fromStep: 0 }],
  steps: [
    { type: 'talk', target: 'rival', hint: 'Habla con Oolong.', lines: [{ who: 'Oolong', text: '¡Te reto!' }] },
    { type: 'battle', target: 'rival', game: 'tictactoe', config: { level: 'easy' }, hint: 'Gana a Oolong.',
      lines: [{ who: 'Oolong', text: '¡Tres en raya!' }], win: [{ who: 'Oolong', text: 'Vaaale...' }], lose: [{ who: 'Oolong', text: '¡Ja!' }] }
  ],
  reward: { zeni: 50, items: [], characters: [] }
}

function edit (m) {
  editingId.value = m.id
  draft.value = JSON.stringify(m, null, 2)
  errors.value = []
  okMsg.value = ''
}
function newMission () {
  editingId.value = null
  draft.value = JSON.stringify(TEMPLATE, null, 2)
  errors.value = []
}
function check () {
  okMsg.value = ''
  if (!parsed.value) { errors.value = ['JSON no válido']; return false }
  errors.value = validateMission(parsed.value, { maps: MAPS, games: Object.keys(MINIGAMES) })
  return !errors.value.length
}
function validate () { if (check()) okMsg.value = '✔ Misión válida' }
async function publish () {
  if (!check()) return
  try {
    await missions.publish(parsed.value)
    editingId.value = parsed.value.id
    okMsg.value = '🚀 Publicada. Los jugadores la verán al abrir el juego.'
  } catch (e) {
    errors.value = ['No se pudo publicar: ' + e.message]
  }
}
async function remove () {
  if (!confirm('¿Eliminar la versión publicada?')) return
  await missions.remove(editingId.value)
  const seed = missions.byId(editingId.value)
  if (seed) edit(seed)
  else { draft.value = null; editingId.value = null }
}
function exportPack () {
  const blob = new Blob([JSON.stringify(missions.published, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'dragonworldz-missions.json'
  a.click()
}
async function importPack () {
  let list
  try { list = JSON.parse(importText.value) } catch { errors.value = ['JSON de importación no válido']; return }
  if (!Array.isArray(list)) list = [list]
  const bad = list.flatMap(m => validateMission(m, { maps: MAPS, games: Object.keys(MINIGAMES) }).map(e => `${m.id}: ${e}`))
  if (bad.length) { errors.value = bad; draft.value ??= ''; return }
  for (const m of list) await missions.publish(m)
  importText.value = ''
  importOpen.value = false
}

// ---------- Sprites ----------
const spriteId = ref('goku')
const spriteSize = ref(24)
const spriteColors = ref(10)
const spriteResult = ref(null)
const currentCanvas = ref(null)
const newCanvas = ref(null)
let lastImage = null

function drawGrid (canvas, grid, palette) {
  if (!canvas) return
  const scale = 6
  canvas.width = Math.max(...grid.map(r => r.length)) * scale
  canvas.height = grid.length * scale
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  grid.forEach((row, y) => [...row].forEach((ch, x) => {
    if (!palette[ch]) return
    ctx.fillStyle = palette[ch]
    ctx.fillRect(x * scale, y * scale, scale, scale)
  }))
}
function drawCurrent () {
  const c = sprites.custom[spriteId.value]
  if (c) drawGrid(currentCanvas.value, c.grid, c.palette)
  else drawGrid(currentCanvas.value, CHARACTERS[spriteId.value].grid, PALETTE)
}
function loadImage (e) {
  const file = e.target.files[0]
  if (!file) return
  const img = new Image()
  img.onload = () => { lastImage = img; process() }
  img.src = URL.createObjectURL(file)
}
async function process () {
  if (!lastImage) return
  spriteResult.value = imageToGrid(lastImage, { size: spriteSize.value, maxColors: spriteColors.value })
  await nextTick()
  drawGrid(newCanvas.value, spriteResult.value.grid, spriteResult.value.palette)
}
async function saveSprite () {
  await sprites.save(spriteId.value, spriteResult.value)
  drawCurrent()
}
watch(spriteId, () => nextTick(drawCurrent))
watch(tab, t => { if (t === 'sprites') nextTick(drawCurrent) })

onMounted(() => { if (missions.all[0]) edit(missions.all[0]) })
</script>

<style scoped>
.admin { max-width: 1100px; }
.tabs { display: flex; gap: 8px; margin: 10px 0; }
.grid { display: grid; grid-template-columns: 1fr; gap: 12px; }
@media (min-width: 800px) { .grid { grid-template-columns: 300px 1fr; } }
.list { display: flex; flex-direction: column; gap: 6px; }
.list-actions { display: flex; gap: 6px; flex-wrap: wrap; }
.pack h3 { font-size: 9px; color: var(--yellow); margin: 10px 0 4px; }
.item {
  display: flex; flex-direction: column; gap: 4px; width: 100%; text-align: left; background: #1c1c44; color: #fff;
  border: 2px solid #3a3a7a; padding: 8px; font-family: inherit; font-size: 9px; margin-bottom: 4px; cursor: pointer;
}
.item.on { border-color: var(--yellow); }
.item small { opacity: .7; font-size: 7px; }
.item em { font-style: normal; background: #3a3a7a; padding: 1px 4px; margin-left: 4px; }
.item em.dlc { background: #7a4bb0; }
.item em.mod { background: #b4533c; }
.item em.off { background: #555; }
.editor-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; font-size: 10px; }
.json, .import textarea {
  width: 100%; min-height: 380px; background: #0b0b2a; color: #9ef09e; border: 2px solid #3a3a7a;
  font-family: ui-monospace, monospace; font-size: 12px; padding: 8px; box-sizing: border-box;
}
.import textarea { min-height: 120px; }
.errors { color: #ff8a8a; font-size: 9px; line-height: 1.8; padding-left: 16px; }
.ok { color: #9ef09e; font-size: 9px; }
.help { font-size: 8px; line-height: 1.8; margin-top: 10px; }
.help code, p code { color: var(--yellow); }
.sprites .row { display: flex; gap: 14px; flex-wrap: wrap; font-size: 9px; margin: 10px 0; }
.sprites label { display: flex; flex-direction: column; gap: 6px; }
.previews { display: flex; gap: 20px; margin: 14px 0; }
.previews > div { display: flex; flex-direction: column; gap: 6px; font-size: 8px; }
.pix { image-rendering: pixelated; background: repeating-conic-gradient(#333 0 25%, #444 0 50%) 0 0 / 12px 12px; max-width: 240px; }
</style>
