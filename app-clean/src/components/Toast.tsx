import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'
import { CheckCircle2, AlertCircle, Info, X, AlertTriangle, Sparkles } from 'lucide-react'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

interface Toast {
  id: string
  title: string
  message?: string
  type: ToastType
  duration?: number
}

interface ToastContextValue {
  toasts: Toast[]
  showToast: (title: string, type?: ToastType, message?: string, duration?: number) => void
  removeToast: (id: string) => void
  success: (title: string, message?: string) => void
  error: (title: string, message?: string) => void
  warning: (title: string, message?: string) => void
  info: (title: string, message?: string) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

// Toast configuration per type
const toastConfig: Record<ToastType, { 
  bgGradient: string; 
  borderColor: string; 
  iconColor: string;
  emoji: string;
}> = {
  success: {
    bgGradient: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(5, 150, 105, 0.08))',
    borderColor: '#10b981',
    iconColor: '#10b981',
    emoji: '✨'
  },
  error: {
    bgGradient: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(220, 38, 38, 0.08))',
    borderColor: '#ef4444',
    iconColor: '#ef4444',
    emoji: '❌'
  },
  warning: {
    bgGradient: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(217, 119, 6, 0.08))',
    borderColor: '#f59e0b',
    iconColor: '#f59e0b',
    emoji: '⚠️'
  },
  info: {
    bgGradient: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(37, 99, 235, 0.08))',
    borderColor: '#3b82f6',
    iconColor: '#3b82f6',
    emoji: 'ℹ️'
  }
}

// Subtle sound frequencies for different toast types
const SOUND_FREQUENCIES: Record<ToastType, number[]> = {
  success: [523, 659], // C5, E5 - pleasant major third
  error: [349, 330],   // F4, E4 - dissonant descending
  warning: [440, 440], // A4, A4 - attention single
  info: [392, 494],    // G4, B4 - neutral ascending
}

function playToastSound(type: ToastType, soundEnabled: boolean = true) {
  if (!soundEnabled) return
  
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
      gainNode.gain.linearRampToValueAtTime(0.06, audioContext.currentTime + i * 0.08 + 0.02)
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

  const showToast = useCallback((title: string, type: ToastType = 'info', message?: string, duration = 4000) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    const toast: Toast = { id, title, message, type, duration }
    
    setToasts(prev => [...prev, toast])
    
    // Check sound setting from localStorage (avoid circular dependency with SettingsContext)
    let soundEnabled = true
    try {
      const settings = localStorage.getItem('app_settings')
      if (settings) {
        const parsed = JSON.parse(settings)
        soundEnabled = parsed.soundEnabled !== false // default to true
      }
    } catch { /* ignore parsing errors */ }
    
    playToastSound(type, soundEnabled)

    if (duration > 0) {
      const timeout = setTimeout(() => removeToast(id), duration)
      timeoutRefs.current.set(id, timeout)
    }
  }, [removeToast])

  const success = useCallback((title: string, message?: string) => {
    showToast(title, 'success', message, 4000)
  }, [showToast])

  const error = useCallback((title: string, message?: string) => {
    showToast(title, 'error', message, 6000)
  }, [showToast])

  const warning = useCallback((title: string, message?: string) => {
    showToast(title, 'warning', message, 5000)
  }, [showToast])

  const info = useCallback((title: string, message?: string) => {
    showToast(title, 'info', message, 4000)
  }, [showToast])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      timeoutRefs.current.forEach(timeout => clearTimeout(timeout))
    }
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast, success, error, warning, info }}>
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
    <>
      <div style={{
        position: 'fixed',
        top: 20,
        right: 20,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        pointerEvents: 'none'
      }}>
        {toasts.map((toast, index) => (
          <ToastItem 
            key={toast.id} 
            toast={toast} 
            onDismiss={onDismiss}
            index={index}
          />
        ))}
      </div>
      
      {/* Inject keyframes */}
      <style>{`
        @keyframes toast-slide-in {
          from {
            opacity: 0;
            transform: translateX(100%) scale(0.85);
          }
          to {
            opacity: 1;
            transform: translateX(0) scale(1);
          }
        }
        
        @keyframes toast-slide-out {
          from {
            opacity: 1;
            transform: translateX(0) scale(1);
          }
          to {
            opacity: 0;
            transform: translateX(100%) scale(0.85);
          }
        }
        
        @keyframes toast-icon-pop {
          0% {
            transform: scale(0) rotate(-45deg);
          }
          60% {
            transform: scale(1.2) rotate(5deg);
          }
          100% {
            transform: scale(1) rotate(0deg);
          }
        }
        
        @keyframes toast-progress {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
        
        @keyframes toast-shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(400%);
          }
        }
        
        @keyframes toast-confetti {
          0% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-20px) scale(0.5); }
        }
      `}</style>
    </>
  )
}

// Individual Toast Component - Premium Version
function ToastItem({ toast, onDismiss, index }: { toast: Toast, onDismiss: (id: string) => void, index: number }) {
  const [isExiting, setIsExiting] = useState(false)
  const config = toastConfig[toast.type]

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
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '14px 16px',
        background: config.bgGradient,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: `1px solid ${config.borderColor}30`,
        borderLeft: `4px solid ${config.borderColor}`,
        borderRadius: 14,
        boxShadow: `0 10px 40px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.08), 0 0 0 1px ${config.borderColor}15`,
        minWidth: 320,
        maxWidth: 420,
        animation: isExiting 
          ? 'toast-slide-out 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards' 
          : 'toast-slide-in 0.45s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        animationDelay: isExiting ? '0s' : `${index * 0.08}s`,
        position: 'relative',
        overflow: 'hidden',
        pointerEvents: 'auto'
      }}
      role="alert"
    >
      {/* Top shimmer line */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '30%',
          height: 2,
          background: `linear-gradient(90deg, transparent, ${config.borderColor}80, transparent)`,
          animation: 'toast-shimmer 2s ease-in-out infinite',
          animationDelay: '0.5s'
        }}
      />
      
      {/* Icon with pop animation */}
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          background: `${config.borderColor}18`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          color: config.iconColor,
          animation: 'toast-icon-pop 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          animationDelay: `${index * 0.08 + 0.15}s`,
          transform: 'scale(0)',
        }}
      >
        {iconMap[toast.type]}
      </div>
      
      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: 600,
            fontSize: 14,
            color: 'var(--text-primary)',
            marginBottom: toast.message ? 3 : 0,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            lineHeight: 1.3
          }}
        >
          <span>{toast.title}</span>
          <span style={{ fontSize: 15 }}>{config.emoji}</span>
        </div>
        {toast.message && (
          <div
            style={{
              fontSize: 13,
              color: 'var(--text-secondary)',
              lineHeight: 1.4,
              opacity: 0.9
            }}
          >
            {toast.message}
          </div>
        )}
      </div>
      
      {/* Close button */}
      <button
        onClick={handleDismiss}
        style={{
          background: 'transparent',
          border: 'none',
          padding: 6,
          cursor: 'pointer',
          color: 'var(--text-muted)',
          borderRadius: 8,
          transition: 'all 0.2s',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0.6
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = `${config.borderColor}20`
          e.currentTarget.style.color = config.iconColor
          e.currentTarget.style.opacity = '1'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.color = 'var(--text-muted)'
          e.currentTarget.style.opacity = '0.6'
        }}
        aria-label="Cerrar"
      >
        <X size={16} />
      </button>
      
      {/* Progress bar */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          height: 3,
          background: `linear-gradient(90deg, ${config.borderColor}, ${config.borderColor}80)`,
          borderRadius: '0 0 0 14px',
          animation: `toast-progress ${toast.duration || 4000}ms linear forwards`,
          animationDelay: `${index * 0.08}s`
        }}
      />
    </div>
  )
}
