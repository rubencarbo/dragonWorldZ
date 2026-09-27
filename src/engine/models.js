// Modelos vóxel de los objetos y lugares emblemáticos.
import * as THREE from 'three'
import { blocks, spriteToVoxels } from './voxel.js'
import { CHARACTERS, PALETTE } from '../data/characters.js'
import { useSpritesStore } from '../stores/sprites.js'

export function characterModel (id, size = 0.06) {
  const custom = useSpritesStore().custom[id]
  if (custom) {
    const scale = (16 * size) / custom.grid.length
    return spriteToVoxels(custom.grid, custom.palette, { size: scale, depth: 2 })
  }
  const ch = CHARACTERS[id] || CHARACTERS.goku
  return spriteToVoxels(ch.grid, PALETTE, { size, depth: 3 })
}

export function kintonModel () {
  const y = '#f6d33c'
  const o = '#f0b429'
  return blocks([
    [0, 0, 0, 0.8, 0.18, 0.5, y],
    [-0.35, 0.08, 0, 0.35, 0.2, 0.35, y],
    [0.35, 0.08, 0, 0.35, 0.2, 0.35, y],
    [0.55, -0.02, 0, 0.3, 0.12, 0.2, o],
    [-0.62, 0.02, 0, 0.25, 0.1, 0.18, o]
  ])
}

export function dragonBallModel (stars = 4, r = 0.18) {
  const g = new THREE.Group()
  const ball = new THREE.Mesh(
    new THREE.IcosahedronGeometry(r, 1),
    new THREE.MeshLambertMaterial({ color: '#ff9a1f', emissive: '#7a3300', flatShading: true })
  )
  ball.position.y = r
  g.add(ball)
  const star = new THREE.MeshBasicMaterial({ color: '#d6333a' })
  const pos = [[0, 0.05], [-0.05, -0.04], [0.05, -0.04], [0, -0.1], [0.07, 0.07], [-0.07, 0.07], [0, 0.12]]
  for (let i = 0; i < stars; i++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.02), star)
    s.position.set(pos[i][0] * r * 5, r + pos[i][1] * r * 5, r * 0.95)
    g.add(s)
  }
  return g
}

export function propModel (prop) {
  switch (prop.kind) {
    case 'npc': return characterModel(prop.sprite, 0.055)
    case 'ball': return dragonBallModel(prop.stars || 1)
    case 'cabin': return blocks([
      [0, 0, 0, 0.9, 0.55, 0.8, '#c98e4a'],
      [0, 0.55, 0, 1.0, 0.18, 0.9, '#b23a2a'],
      [0, 0.73, 0, 0.7, 0.14, 0.9, '#b23a2a'],
      [0, 0.87, 0, 0.35, 0.1, 0.9, '#b23a2a'],
      [0, 0, 0.41, 0.25, 0.38, 0.02, '#5a3314'],
      [0.28, 0.2, 0.41, 0.18, 0.15, 0.02, '#8fd3ff']
    ])
    case 'altar': return blocks([
      [0, 0, 0, 0.6, 0.35, 0.4, '#7c4a22'],
      [0, 0.35, 0, 0.3, 0.06, 0.3, '#c0392b'],
      [0, 0.41, 0, 0.44, 0.35, 0.05, '#e8d3a0']
    ])
    case 'sign': return blocks([
      [0, 0, 0, 0.08, 0.5, 0.08, '#7c4a22'],
      [0, 0.4, 0, 0.6, 0.3, 0.06, '#c98e4a']
    ])
    case 'kamehouse': return blocks([
      [0, 0, 0, 0.95, 0.6, 0.8, '#f29ec0'],
      [0, 0.6, 0, 1.05, 0.2, 0.9, '#d6333a'],
      [0, 0.8, 0, 0.75, 0.15, 0.9, '#d6333a'],
      [0, 0.35, 0.41, 0.6, 0.1, 0.02, '#f4f4f4'],
      [0, 0, 0.41, 0.22, 0.3, 0.02, '#7c4a22']
    ])
    case 'palm': return blocks([
      [0, 0, 0, 0.12, 0.9, 0.12, '#9c6b3a'],
      [0, 0.9, 0, 0.8, 0.08, 0.2, '#3e9b3e'],
      [0, 0.9, 0, 0.2, 0.08, 0.8, '#3e9b3e'],
      [0.1, 0.82, 0.1, 0.12, 0.12, 0.12, '#6b4a2a']
    ])
    case 'dome': {
      const g = new THREE.Group()
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(0.75, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshLambertMaterial({ color: '#f1f1f1', flatShading: true })
      )
      dome.castShadow = true
      g.add(dome)
      g.add(blocks([
        [0, 0, 0.7, 0.35, 0.3, 0.1, '#2250b8'],
        [0, 0.4, 0.68, 0.5, 0.08, 0.02, '#2250b8']
      ]))
      return g
    }
    case 'crate': return blocks([
      [0, 0, 0, 0.5, 0.4, 0.5, '#9a9aa8'],
      [-0.1, 0.4, 0, 0.12, 0.1, 0.12, '#d6333a'],
      [0.1, 0.4, 0.05, 0.12, 0.1, 0.12, '#f6d33c']
    ])
    case 'jar': return blocks([
      [0, 0, 0, 0.3, 0.3, 0.3, '#e0e0e8'],
      [0, 0.3, 0, 0.14, 0.12, 0.14, '#e0e0e8'],
      [0, 0.15, 0.151, 0.14, 0.1, 0.01, '#5fc9d8']
    ])
    case 'pillar': return blocks([
      [0, 0, 0, 0.3, 1.1, 0.3, '#f2e3c2'],
      [0, 1.1, 0, 0.45, 0.1, 0.45, '#d9c49a']
    ])
    case 'footprints': return blocks([
      [-0.15, 0, -0.2, 0.18, 0.02, 0.26, '#5a3a1a'],
      [0.15, 0, 0.15, 0.18, 0.02, 0.26, '#5a3a1a']
    ])
    case 'bean': return blocks([
      [0, 0.05, 0, 0.14, 0.1, 0.09, '#6fcf4a'],
      [0, 0, 0, 0.3, 0.05, 0.3, '#c98e4a']
    ])
    case 'tower': return blocks([
      [0, 0, 0, 0.14, 1.6, 0.14, '#f2e3c2'],
      [0, 1.6, 0, 0.35, 0.12, 0.35, '#d9c49a'],
      [0, 1.72, 0, 0.18, 0.18, 0.18, '#e0e0e8']
    ])
    default: return blocks([[0, 0, 0, 0.3, 0.3, 0.3, '#ff00ff']])
  }
}

export function treeModel () {
  return blocks([
    [0, 0, 0, 0.18, 0.4, 0.18, '#7c4a22'],
    [0, 0.4, 0, 0.7, 0.4, 0.7, '#2f7d32'],
    [0, 0.8, 0, 0.45, 0.3, 0.45, '#3e9b3e']
  ])
}
