import { defineStore } from 'pinia'
import { progressRepo } from '../services/repo.js'
import { useMissionsStore } from './missions.js'
import { getLocation } from '../data/worlds.js'
import { isMissionAvailable, resolveInteraction, visibleSpawns } from '../engine/missionLogic.js'
import { chiptune } from '../engine/chiptune.js'

const ITEM_NAMES = { esfera_4: 'Esfera de 4 estrellas', radar: 'Radar del dragón', senzu: 'Semilla del ermitaño' }

const fresh = () => ({
  worldId: 'tierra',
  locationId: 'paoz',
  character: 'goku',
  team: ['goku'],
  completed: [],
  active: null, // { missionId, step }
  zeni: 0,
  inventory: []
})

export const useGameStore = defineStore('game', {
  state: () => ({
    progress: fresh(),
    ready: false,
    dialog: null, // { lines, index, onDone }
    battle: null, // { step, enemy, missionId }
    toast: ''
  }),
  getters: {
    activeMission () {
      const a = this.progress.active
      return a ? useMissionsStore().byId(a.missionId) : null
    },
    currentStep () {
      return this.activeMission?.steps[this.progress.active.step] || null
    },
    availableAt () {
      return locationId => useMissionsStore().all.filter(m =>
        m.locationId === locationId && isMissionAvailable(m, this.progress.completed))
    },
    spawnsAt () {
      return locationId => {
        const m = this.activeMission
        if (!m || m.locationId !== locationId) return []
        return visibleSpawns(m, this.progress.active.step)
      }
    },
    itemName: () => id => ITEM_NAMES[id] || id
  },
  actions: {
    async load () {
      const saved = await progressRepo.load()
      if (saved) this.progress = { ...fresh(), ...saved }
      this.ready = true
    },
    save () {
      progressRepo.save(JSON.parse(JSON.stringify(this.progress)))
    },
    reset () {
      this.progress = fresh()
      this.save()
    },
    flash (msg) {
      this.toast = msg
      clearTimeout(this._t)
      this._t = setTimeout(() => { this.toast = '' }, 2200)
    },

    say (lines, onDone) {
      if (!lines?.length) { onDone?.(); return }
      this.dialog = { lines, index: 0, onDone }
    },
    nextLine () {
      const d = this.dialog
      if (!d) return
      chiptune.sfx('talk')
      if (d.index < d.lines.length - 1) { d.index++; return }
      this.dialog = null
      d.onDone?.()
    },

    travelTo (worldId, locationId) {
      this.progress.worldId = worldId
      this.progress.locationId = locationId
      this.save()
    },

    startMission (id) {
      const m = useMissionsStore().byId(id)
      if (!m) return
      if (m.locationId !== this.progress.locationId) {
        const loc = getLocation(m.locationId)
        this.flash(`Esta misión empieza en ${loc?.name || m.locationId}`)
        return
      }
      this.progress.active = { missionId: id, step: 0 }
      this.save()
      this.say(m.intro, () => this.flash(m.steps[0].hint || ''))
    },
    abandonMission () {
      this.progress.active = null
      this.save()
    },

    interact (prop) {
      const m = this.activeMission
      const res = resolveInteraction(m, this.progress.active?.step, prop.id)
      if (res.kind === 'flavor') {
        this.say(prop.lines || [{ who: prop.name, text: '...' }])
        return
      }
      const step = res.step
      if (res.kind === 'battle') {
        this.say(step.lines, () => {
          this.battle = { step, enemy: prop, missionId: m.id }
          chiptune.play('batalla')
        })
        return
      }
      this.say(step.lines, () => {
        if (res.kind === 'collect' && step.item) {
          this.progress.inventory.push(step.item)
          chiptune.sfx('coin')
          this.flash(`¡Conseguido: ${this.itemName(step.item)}!`)
        }
        this.advance()
      })
    },

    finishBattle (won, musicAfter) {
      const b = this.battle
      if (!b) return
      this.battle = null
      chiptune.play(musicAfter)
      this.say(won ? b.step.win : b.step.lose, () => { if (won) this.advance() })
    },

    advance () {
      const m = this.activeMission
      if (!m) return
      const next = this.progress.active.step + 1
      if (next < m.steps.length) {
        this.progress.active.step = next
        this.save()
        if (m.steps[next].hint) this.flash(m.steps[next].hint)
        return
      }
      this.completeMission(m)
    },

    completeMission (m) {
      const r = m.reward || {}
      this.progress.completed.push(m.id)
      this.progress.active = null
      this.progress.zeni += r.zeni || 0
      for (const it of r.items || []) this.progress.inventory.push(it)
      for (const c of r.characters || []) if (!this.progress.team.includes(c)) this.progress.team.push(c)
      this.save()
      chiptune.play('victoria')
      const lines = [{ who: '¡MISIÓN COMPLETADA!', text: `${m.title} · +${r.zeni || 0} zenis` }]
      if (r.characters?.length) lines.push({ who: 'Equipo', text: `Nuevo personaje disponible: ${r.characters.join(', ')}` })
      this.say(lines)
    }
  }
})
