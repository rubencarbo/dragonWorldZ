import { defineStore } from 'pinia'
import { spritesRepo } from '../services/repo.js'

// Sprites personalizados (generados desde imágenes en Admin → Sprites)
export const useSpritesStore = defineStore('sprites', {
  state: () => ({ custom: {} }),
  actions: {
    async load () {
      const list = await spritesRepo.list()
      this.custom = Object.fromEntries(list.map(s => [s.id, s]))
    },
    async save (id, sprite) {
      await spritesRepo.save(id, sprite)
      this.custom = { ...this.custom, [id]: { ...sprite, id } }
    },
    async remove (id) {
      await spritesRepo.remove(id)
      const { [id]: _, ...rest } = this.custom
      this.custom = rest
    }
  }
})
