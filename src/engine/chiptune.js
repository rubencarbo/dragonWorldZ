// Sintetizador chiptune mínimo con WebAudio: lead (onda cuadrada 25%),
// bajo (triangular) y batería (ruido). Programa las notas con "lookahead"
// para que el bucle sea estable aunque el hilo principal esté ocupado.
import { TRACKS } from '../data/music.js'

const NOTE_INDEX = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 }

export function noteToFreq (note) {
  const m = /^([A-G]#?)(\d)$/.exec(note)
  if (!m) return null
  const midi = (Number(m[2]) + 1) * 12 + NOTE_INDEX[m[1]]
  return 440 * Math.pow(2, (midi - 69) / 12)
}

// Convierte 'C5 - E5 .' en [{freq, len}, null, ...] (un evento por paso)
export function parsePattern (str = '') {
  const tokens = str.trim().split(/\s+/).filter(Boolean)
  const events = new Array(tokens.length).fill(null)
  tokens.forEach((t, i) => {
    if (t === '-' || t === '.') return
    let len = 1
    while (tokens[i + len] === '-') len++
    events[i] = { token: t, freq: noteToFreq(t), len }
  })
  return events
}

class Chiptune {
  constructor () {
    this.ctx = null
    this.master = null
    this.volume = 0.5
    this.current = null
    this.timer = null
  }

  ensure () {
    if (this.ctx) return true
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext
    if (!AC) return false
    this.ctx = new AC()
    this.master = this.ctx.createGain()
    this.master.gain.value = this.volume * 0.35
    this.master.connect(this.ctx.destination)
    // Onda cuadrada con ciclo de trabajo 25% (sonido "NES")
    const n = 32
    const real = new Float32Array(n)
    const imag = new Float32Array(n)
    for (let k = 1; k < n; k++) imag[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * 0.25)
    this.pulse = this.ctx.createPeriodicWave(real, imag)
    const len = this.ctx.sampleRate
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
    const data = this.noise.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    return true
  }

  setVolume (v) {
    this.volume = v
    if (this.master) this.master.gain.value = v * 0.35
  }

  resume () {
    if (this.ensure() && this.ctx.state === 'suspended') this.ctx.resume()
  }

  play (trackId) {
    if (this.current?.id === trackId) return
    this.stop()
    const track = TRACKS[trackId]
    if (!track || !this.ensure()) return
    const channels = {
      lead: parsePattern(track.lead),
      bass: parsePattern(track.bass),
      drums: (track.drums || '').trim().split(/\s+/)
    }
    const steps = Math.max(channels.lead.length, channels.bass.length)
    const stepDur = 60 / track.bpm / 2
    this.current = { id: trackId, track, channels, steps, stepDur, step: 0, next: this.ctx.currentTime + 0.05 }
    this.timer = setInterval(() => this.schedule(), 25)
  }

  stop () {
    clearInterval(this.timer)
    this.timer = null
    this.current = null
  }

  schedule () {
    const c = this.current
    if (!c) return
    while (c.next < this.ctx.currentTime + 0.12) {
      if (c.track.once && c.step >= c.steps) { this.stop(); return }
      const i = c.step % c.steps
      const lead = c.channels.lead[i % c.channels.lead.length]
      const bass = c.channels.bass[i % c.channels.bass.length]
      const drum = c.channels.drums[i % c.channels.drums.length]
      if (lead?.freq) this.tone('pulse', lead.freq, c.next, lead.len * c.stepDur, 0.22)
      if (bass?.freq) this.tone('triangle', bass.freq, c.next, bass.len * c.stepDur, 0.4)
      if (drum && drum !== '.') this.drum(drum, c.next)
      c.step++
      c.next += c.stepDur
    }
  }

  tone (type, freq, t, dur, vol) {
    const osc = this.ctx.createOscillator()
    if (type === 'pulse') osc.setPeriodicWave(this.pulse)
    else osc.type = type
    osc.frequency.value = freq
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(vol, t)
    g.gain.setValueAtTime(vol, t + Math.max(0.01, dur - 0.03))
    g.gain.linearRampToValueAtTime(0, t + dur)
    osc.connect(g).connect(this.master)
    osc.start(t)
    osc.stop(t + dur + 0.01)
  }

  drum (kind, t) {
    if (kind === 'k') {
      const osc = this.ctx.createOscillator()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(150, t)
      osc.frequency.exponentialRampToValueAtTime(40, t + 0.12)
      const g = this.ctx.createGain()
      g.gain.setValueAtTime(0.7, t)
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.15)
      osc.connect(g).connect(this.master)
      osc.start(t)
      osc.stop(t + 0.16)
      return
    }
    const src = this.ctx.createBufferSource()
    src.buffer = this.noise
    const f = this.ctx.createBiquadFilter()
    f.type = kind === 'h' ? 'highpass' : 'bandpass'
    f.frequency.value = kind === 'h' ? 7000 : 1800
    const g = this.ctx.createGain()
    const len = kind === 'h' ? 0.04 : 0.12
    g.gain.setValueAtTime(kind === 'h' ? 0.15 : 0.35, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + len)
    src.connect(f).connect(g).connect(this.master)
    src.start(t, Math.random() * 0.5)
    src.stop(t + len)
  }

  // Efectos cortos (pasos, recoger objeto, acierto/error)
  sfx (name) {
    if (!this.ensure()) return
    const t = this.ctx.currentTime
    const seqs = {
      step: [['C6', 0.03]],
      coin: [['B5', 0.06], ['E6', 0.14]],
      ok: [['C5', 0.06], ['E5', 0.06], ['G5', 0.1]],
      bad: [['E4', 0.08], ['C4', 0.16]],
      dice: [['G5', 0.03], ['A5', 0.03], ['B5', 0.03], ['D6', 0.06]],
      talk: [['A5', 0.02]]
    }
    let at = t
    for (const [n, d] of seqs[name] || []) {
      this.tone('pulse', noteToFreq(n), at, d, 0.15)
      at += d
    }
  }
}

export const chiptune = new Chiptune()
