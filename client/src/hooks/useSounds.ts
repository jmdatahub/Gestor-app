import { useCallback } from 'react'
import { useSettings } from '../context/SettingsContext'

// Audio context singleton
let audioContext: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  
  if (!audioContext) {
    try {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    } catch (e) {
      console.warn('Web Audio API not supported')
      return null
    }
  }
  return audioContext
}

// Sound generators using Web Audio API
function playTone(frequency: number, duration: number, type: OscillatorType = 'sine', volume: number = 0.3) {
  const ctx = getAudioContext()
  if (!ctx) return
  
  // Resume context if suspended (browser autoplay policy)
  if (ctx.state === 'suspended') {
    ctx.resume()
  }

  const oscillator = ctx.createOscillator()
  const gainNode = ctx.createGain()

  oscillator.connect(gainNode)
  gainNode.connect(ctx.destination)

  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, ctx.currentTime)

  // Fade in and out for smoothness
  gainNode.gain.setValueAtTime(0, ctx.currentTime)
  gainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.01)
  gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + duration)

  oscillator.start(ctx.currentTime)
  oscillator.stop(ctx.currentTime + duration)
}

// Predefined sounds
const sounds = {
  success: () => {
    // Pleasant ascending chime
    playTone(523.25, 0.1, 'sine', 0.2) // C5
    setTimeout(() => playTone(659.25, 0.1, 'sine', 0.2), 80) // E5
    setTimeout(() => playTone(783.99, 0.15, 'sine', 0.2), 160) // G5
  },
  
  error: () => {
    // Low warning buzz
    playTone(200, 0.15, 'square', 0.15)
    setTimeout(() => playTone(180, 0.2, 'square', 0.12), 120)
  },
  
  warning: () => {
    // Alert ping
    playTone(440, 0.1, 'triangle', 0.2)
    setTimeout(() => playTone(440, 0.1, 'triangle', 0.2), 150)
  },
  
  click: () => {
    // Subtle click
    playTone(1000, 0.03, 'sine', 0.1)
  },
  
  notification: () => {
    // Soft notification ding
    playTone(880, 0.08, 'sine', 0.15) // A5
    setTimeout(() => playTone(1174.66, 0.12, 'sine', 0.12), 80) // D6
  },
  
  delete: () => {
    // Descending tone
    playTone(440, 0.08, 'sine', 0.15)
    setTimeout(() => playTone(349.23, 0.1, 'sine', 0.12), 60)
    setTimeout(() => playTone(261.63, 0.12, 'sine', 0.1), 120)
  },
  
  complete: () => {
    // Completion fanfare
    playTone(523.25, 0.08, 'sine', 0.15)
    setTimeout(() => playTone(659.25, 0.08, 'sine', 0.15), 100)
    setTimeout(() => playTone(783.99, 0.08, 'sine', 0.15), 200)
    setTimeout(() => playTone(1046.5, 0.2, 'sine', 0.2), 300)
  }
}

export type SoundType = keyof typeof sounds

export function useSounds() {
  const { settings } = useSettings()
  
  const play = useCallback((sound: SoundType) => {
    if (!settings.soundEnabled) return
    
    try {
      sounds[sound]?.()
    } catch (e) {
      console.warn('Error playing sound:', e)
    }
  }, [settings.soundEnabled])
  
  return { play, isEnabled: settings.soundEnabled }
}

export default useSounds
