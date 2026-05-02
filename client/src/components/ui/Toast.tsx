import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, XCircle, AlertTriangle, Info, X, Sparkles } from 'lucide-react'

// Toast types
type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: string
  type: ToastType
  title: string
  message?: string
  duration?: number
}

interface ToastContextType {
  showToast: (type: ToastType, title: string, message?: string, duration?: number) => void
  success: (title: string, message?: string) => void
  error: (title: string, message?: string) => void
  warning: (title: string, message?: string) => void
  info: (title: string, message?: string) => void
}

const ToastContext = createContext<ToastContextType | null>(null)

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return context
}

// Toast configuration per type — uses CSS variables so dark/light themes work automatically
const toastConfig: Record<ToastType, {
  icon: typeof CheckCircle2;
  colorVar: string; // CSS variable name for the semantic color
  emoji: string;
}> = {
  success: {
    icon: CheckCircle2,
    colorVar: '--success',
    emoji: '✨'
  },
  error: {
    icon: XCircle,
    colorVar: '--danger',
    emoji: '❌'
  },
  warning: {
    icon: AlertTriangle,
    colorVar: '--warning',
    emoji: '⚠️'
  },
  info: {
    icon: Info,
    colorVar: '--info',
    emoji: 'ℹ️'
  }
}

// Individual Toast component
function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const config = toastConfig[toast.type]
  const Icon = config.icon
  // Resolve the CSS variable name into the data-attribute selector
  const colorRef = `var(${config.colorVar})`
  const softColorRef = `var(${config.colorVar.replace('--', '--') + '-soft'})`

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '14px 16px',
        background: `var(--bg-card)`,
        backdropFilter: 'blur(12px)',
        border: `1px solid ${colorRef}`,
        borderLeft: `4px solid ${colorRef}`,
        borderRadius: 12,
        boxShadow: 'var(--shadow-popover)',
        minWidth: 320,
        maxWidth: 420,
        animation: 'toast-slide-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Shimmer effect */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: `linear-gradient(90deg, transparent, ${colorRef}, transparent)`,
          opacity: 0.5,
          animation: 'toast-shimmer 2s infinite'
        }}
      />

      {/* Icon */}
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: softColorRef,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          animation: 'toast-icon-pop 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.1s forwards',
          transform: 'scale(0)',
        }}
      >
        <Icon size={20} style={{ color: colorRef }} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: 600,
            fontSize: 14,
            color: 'var(--text-primary)',
            marginBottom: toast.message ? 4 : 0,
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          <span>{toast.title}</span>
          <span style={{ fontSize: 16 }}>{config.emoji}</span>
        </div>
        {toast.message && (
          <div
            style={{
              fontSize: 13,
              color: 'var(--text-secondary)',
              lineHeight: 1.4
            }}
          >
            {toast.message}
          </div>
        )}
      </div>

      {/* Close button */}
      <button
        onClick={() => onRemove(toast.id)}
        style={{
          background: 'transparent',
          border: 'none',
          padding: 4,
          cursor: 'pointer',
          color: 'var(--text-muted)',
          borderRadius: 6,
          transition: 'all 0.15s',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--bg-surface)'
          e.currentTarget.style.color = 'var(--text-primary)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.color = 'var(--text-muted)'
        }}
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
          background: colorRef,
          borderRadius: '0 0 0 12px',
          animation: `toast-progress ${toast.duration || 4000}ms linear forwards`
        }}
      />
    </div>
  )
}

// Toast container
function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: string) => void }) {
  if (toasts.length === 0) return null
  
  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: 20,
        right: 20,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 12
      }}
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
      
      {/* Inject keyframes */}
      <style>{`
        @keyframes toast-slide-in {
          from {
            opacity: 0;
            transform: translateX(100%) scale(0.8);
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
            transform: translateX(100%) scale(0.8);
          }
        }
        
        @keyframes toast-icon-pop {
          from {
            transform: scale(0) rotate(-45deg);
          }
          to {
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
            transform: translateX(100%);
          }
        }
      `}</style>
    </div>,
    document.body
  )
}

// Provider component
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  
  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])
  
  const showToast = useCallback((type: ToastType, title: string, message?: string, duration = 4000) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    setToasts((prev) => [...prev, { id, type, title, message, duration }])
    
    // Auto remove
    setTimeout(() => {
      removeToast(id)
    }, duration)
  }, [removeToast])
  
  const success = useCallback((title: string, message?: string) => {
    showToast('success', title, message)
  }, [showToast])
  
  const error = useCallback((title: string, message?: string) => {
    showToast('error', title, message, 6000) // Errors stay longer
  }, [showToast])
  
  const warning = useCallback((title: string, message?: string) => {
    showToast('warning', title, message, 5000)
  }, [showToast])
  
  const info = useCallback((title: string, message?: string) => {
    showToast('info', title, message)
  }, [showToast])
  
  return (
    <ToastContext.Provider value={{ showToast, success, error, warning, info }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  )
}
