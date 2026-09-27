import { defineStore } from 'pinia'
import { SEED_MISSIONS } from '../data/missions.js'
import { missionsRepo } from '../services/repo.js'

// Misiones = semilla del juego + publicadas desde Admin (sobrescriben por id)
export const useMissionsStore = defineStore('missions', {
  state: () => ({ published: [], loaded: false }),
  getters: {
    all (state) {
      const map = new Map(SEED_MISSIONS.map(m => [m.id, m]))
      for (const m of state.published) map.set(m.id, m)
      return [...map.values()]
    },
    byId () { return id => this.all.find(m => m.id === id) },
    isSeed: () => id => SEED_MISSIONS.some(m => m.id === id)
  },
  actions: {
    async load () {
      this.published = await missionsRepo.list()
      this.loaded = true
    },
    async publish (mission) {
      await missionsRepo.save(mission)
      this.published = [...this.published.filter(m => m.id !== mission.id), mission]
    },
    async remove (id) {
      await missionsRepo.remove(id)
      this.published = this.published.filter(m => m.id !== id)
    }
  }
})
