import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'
import { CheckCircle2, AlertCircle, Info, X, AlertTriangle } from 'lucide-react'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

interface Toast {
  id: string
  message: string
  type: ToastType
  duration?: number
}

interface ToastContextValue {
  toasts: Toast[]
  showToast: (message: string, type?: ToastType, duration?: number) => void
  removeToast: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

// Subtle sound frequencies for different toast types
const SOUND_FREQUENCIES: Record<ToastType, number[]> = {
  success: [523, 659], // C5, E5 - pleasant major third
  error: [349, 330],   // F4, E4 - dissonant descending
  warning: [440, 440], // A4, A4 - attention single
  info: [392, 494],    // G4, B4 - neutral ascending
}

function playToastSound(type: ToastType) {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    const frequencies = SOUND_FREQUENCIES[type]
    
    frequencies.forEach((freq, i) => {
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)
      
      oscillator.frequency.value = freq
      oscillator.type = 'sine'
      
      // Very subtle volume
      gainNode.gain.setValueAtTime(0, audioContext.currentTime + i * 0.08)
      gainNode.gain.linearRampToValueAtTime(0.08, audioContext.currentTime + i * 0.08 + 0.02)
      gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + i * 0.08 + 0.12)
      
      oscillator.start(audioContext.currentTime + i * 0.08)
      oscillator.stop(audioContext.currentTime + i * 0.08 + 0.15)
    })
  } catch {
    // Audio not supported or blocked, fail silently
  }
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timeoutRefs = useRef<Map<string, NodeJS.Timeout>>(new Map())

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
    const timeout = timeoutRefs.current.get(id)
    if (timeout) {
      clearTimeout(timeout)
      timeoutRefs.current.delete(id)
    }
  }, [])

  const showToast = useCallback((message: string, type: ToastType = 'info', duration = 3500) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    const toast: Toast = { id, message, type, duration }
    
    setToasts(prev => [...prev, toast])
    playToastSound(type)

    if (duration > 0) {
      const timeout = setTimeout(() => removeToast(id), duration)
      timeoutRefs.current.set(id, timeout)
    }
  }, [removeToast])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      timeoutRefs.current.forEach(timeout => clearTimeout(timeout))
    }
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

// Toast Container Component
function ToastContainer({ toasts, onDismiss }: { toasts: Toast[], onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null

  return (
    <div className="toast-container">
      {toasts.map((toast, index) => (
        <ToastItem 
          key={toast.id} 
          toast={toast} 
          onDismiss={onDismiss}
          index={index}
        />
      ))}
    </div>
  )
}

// Individual Toast Component
function ToastItem({ toast, onDismiss, index }: { toast: Toast, onDismiss: (id: string) => void, index: number }) {
  const [isExiting, setIsExiting] = useState(false)

  const handleDismiss = () => {
    setIsExiting(true)
    setTimeout(() => onDismiss(toast.id), 300)
  }

  const iconMap = {
    success: <CheckCircle2 size={20} />,
    error: <AlertCircle size={20} />,
    warning: <AlertTriangle size={20} />,
    info: <Info size={20} />,
  }

  return (
    <div 
      className={`toast toast-${toast.type} ${isExiting ? 'toast-exit' : ''}`}
      style={{ animationDelay: `${index * 50}ms` }}
      role="alert"
    >
      <span className="toast-icon">{iconMap[toast.type]}</span>
      <span className="toast-message">{toast.message}</span>
      <button className="toast-dismiss" onClick={handleDismiss} aria-label="Cerrar">
        <X size={16} />
      </button>
    </div>
  )
}
