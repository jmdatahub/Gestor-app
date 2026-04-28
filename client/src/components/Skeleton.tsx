import { useState, useEffect } from 'react'

interface SkeletonProps {
  className?: string
  style?: React.CSSProperties
}

export function Skeleton({ className = '', style }: SkeletonProps) {
  return <div className={`skeleton ${className}`} style={style} />
}

export function SkeletonText({ width = '100%' }: { width?: string }) {
  return <div className="skeleton skeleton-text" style={{ width }} />
}

export function SkeletonTitle({ width = '40%' }: { width?: string }) {
  return <div className="skeleton skeleton-title" style={{ width }} />
}

export function SkeletonAvatar({ size = 48 }: { size?: number }) {
  return <div className="skeleton skeleton-avatar" style={{ width: size, height: size }} />
}

// KPI Card skeleton - Premium
export function SkeletonKPI() {
  return (
    <div className="skeleton-kpi">
      <div 
        className="skeleton" 
        style={{ 
          width: 48, 
          height: 48, 
          borderRadius: 'var(--radius-md)' 
        }} 
      />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="skeleton" style={{ width: '50%', height: 12, borderRadius: 4 }} />
        <div className="skeleton" style={{ width: '70%', height: 24, borderRadius: 6 }} />
      </div>
    </div>
  )
}

// List row skeleton - Enhanced
export function SkeletonRow() {
  return (
    <div 
      style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '1rem', 
        padding: '1rem',
        borderBottom: '1px solid var(--border-color)'
      }}
    >
      <div className="skeleton" style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)' }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div className="skeleton" style={{ width: '60%', height: 14, borderRadius: 4 }} />
        <div className="skeleton" style={{ width: '35%', height: 10, borderRadius: 3 }} />
      </div>
      <div className="skeleton" style={{ width: 80, height: 18, borderRadius: 4 }} />
    </div>
  )
}

// Fun loading messages
const funMessages = [
  '💰 Contando tus monedas...',
  '📊 Analizando tendencias...',
  '🔮 Prediciendo el futuro...',
  '🚀 Cargando a velocidad luz...',
  '✨ Preparando la magia...',
  '🧮 Haciendo cálculos...',
  '📈 Graficando tu éxito...',
  '💎 Puliendo los datos...',
  '🎯 Apuntando a tus metas...',
  '🌟 Reuniendo información...'
]

// Premium Loading Component
export function PremiumLoader({ message }: { message?: string }) {
  const [funMessage, setFunMessage] = useState(funMessages[0])
  
  useEffect(() => {
    const interval = setInterval(() => {
      setFunMessage(funMessages[Math.floor(Math.random() * funMessages.length)])
    }, 2500)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="loading-premium">
      <div className="loading-premium-spinner" />
      <div className="loading-premium-text">
        {message || funMessage}
        <span className="loading-premium-dots">
          <span></span>
          <span></span>
          <span></span>
        </span>
      </div>
    </div>
  )
}

// Full page skeleton (Dashboard style)
export function SkeletonDashboard() {
  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <SkeletonTitle width="200px" />
          <SkeletonText width="300px" />
        </div>
      </div>

      {/* KPIs */}
      <div className="skeleton-kpi-grid">
        <SkeletonKPI />
        <SkeletonKPI />
        <SkeletonKPI />
        <SkeletonKPI />
      </div>

      {/* Content */}
      <div className="card" style={{ marginTop: '1.5rem' }}>
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </div>
    </div>
  )
}

// List page skeleton - Premium Version
export function SkeletonList({ rows = 5 }: { rows?: number }) {
  const [funMessage, setFunMessage] = useState(funMessages[0])
  
  useEffect(() => {
    const interval = setInterval(() => {
      setFunMessage(funMessages[Math.floor(Math.random() * funMessages.length)])
    }, 2500)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="page-container">
      {/* Header skeleton */}
      <div className="page-header">
        <div>
          <div className="skeleton" style={{ width: 180, height: 28, borderRadius: 6, marginBottom: 8 }} />
          <div className="skeleton" style={{ width: 250, height: 14, borderRadius: 4 }} />
        </div>
        <div className="skeleton" style={{ width: 140, height: 40, borderRadius: 'var(--radius-md)' }} />
      </div>

      {/* Fun loading message */}
      <div style={{ 
        textAlign: 'center', 
        padding: '1.5rem 0',
        animation: 'skeleton-pulse 2s infinite'
      }}>
        <div style={{ 
          fontSize: 32, 
          marginBottom: 8,
          animation: 'spin 3s linear infinite'
        }}>
          🌀
        </div>
        <div style={{ 
          color: 'var(--text-secondary)', 
          fontSize: '0.9rem',
          fontWeight: 500
        }}>
          {funMessage}
        </div>
      </div>

      {/* Card with skeleton rows */}
      <div className="card" style={{ overflow: 'hidden' }}>
        {Array.from({ length: rows }).map((_, i) => (
          <div 
            key={i}
            style={{ 
              animation: `stagger-fade-in 0.3s ease-out backwards`,
              animationDelay: `${i * 0.08}s`
            }}
          >
            <SkeletonRow />
          </div>
        ))}
      </div>
    </div>
  )
}

// Table skeleton
export function SkeletonTable({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div style={{ overflow: 'hidden', borderRadius: 'var(--radius-lg)' }}>
      {/* Header */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: `repeat(${cols}, 1fr)`, 
        gap: '1rem', 
        padding: '1rem',
        background: 'var(--gray-50)',
        borderBottom: '1px solid var(--border-color)'
      }}>
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 12, width: '60%', borderRadius: 4 }} />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div 
          key={rowIndex}
          style={{ 
            display: 'grid', 
            gridTemplateColumns: `repeat(${cols}, 1fr)`, 
            gap: '1rem', 
            padding: '1rem',
            borderBottom: '1px solid var(--border-color)',
            animation: `stagger-fade-in 0.3s ease-out backwards`,
            animationDelay: `${rowIndex * 0.05}s`
          }}
        >
          {Array.from({ length: cols }).map((_, colIndex) => (
            <div 
              key={colIndex} 
              className="skeleton" 
              style={{ 
                height: 14, 
                width: colIndex === 0 ? '80%' : '50%', 
                borderRadius: 4 
              }} 
            />
          ))}
        </div>
      ))}
    </div>
  )
}
