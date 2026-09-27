import { defineStore } from 'pinia'
import { progressRepo } from '../services/repo.js'
import { chiptune } from '../engine/chiptune.js'

const DEFAULTS = { moveMode: 'free', pixelScale: 3, music: 0.5, sfx: true }

export const useSettingsStore = defineStore('settings', {
  state: () => ({ ...DEFAULTS, ...progressRepo.local.get('settings', {}) }),
  actions: {
    update (patch) {
      Object.assign(this, patch)
      chiptune.setVolume(this.music)
      progressRepo.local.set('settings', this.$state)
    }
  }
})
