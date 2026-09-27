// Renderer "retro": dibuja a baja resolución y escala con image-rendering:
// pixelated para conseguir el aspecto 8 bits en cualquier pantalla.
import * as THREE from 'three'

export function createRetroRenderer (container, { pixelScale = 3 } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'low-power' })
  renderer.setPixelRatio(1)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.BasicShadowMap
  const canvas = renderer.domElement
  canvas.style.width = '100%'
  canvas.style.height = '100%'
  canvas.style.imageRendering = 'pixelated'
  canvas.style.display = 'block'
  canvas.style.touchAction = 'none'
  container.appendChild(canvas)

  const state = { pixelScale, onResize: null }

  function resize () {
    const w = container.clientWidth || 1
    const h = container.clientHeight || 1
    renderer.setSize(Math.ceil(w / state.pixelScale), Math.ceil(h / state.pixelScale), false)
    state.onResize?.(w, h)
  }
  const ro = new ResizeObserver(resize)
  ro.observe(container)
  resize()

  return {
    renderer,
    canvas,
    set pixelScale (v) { state.pixelScale = v; resize() },
    set onResize (fn) { state.onResize = fn; resize() },
    dispose () {
      ro.disconnect()
      renderer.dispose()
      canvas.remove()
    }
  }
}

// Coordenadas normalizadas (-1..1) de un evento de puntero sobre el canvas
export function pointerNDC (event, canvas) {
  const r = canvas.getBoundingClientRect()
  return new THREE.Vector2(((event.clientX - r.left) / r.width) * 2 - 1, -((event.clientY - r.top) / r.height) * 2 + 1)
}
