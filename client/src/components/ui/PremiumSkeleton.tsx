import { useState, useEffect } from 'react'

interface SkeletonProps {
  className?: string
  width?: string | number
  height?: string | number
  style?: React.CSSProperties
}

export function Skeleton({ className = '', width, height, style }: SkeletonProps) {
  return (
    <div 
      className={`skeleton ${className}`}
      style={{ 
        width: width || '100%', 
        height: height || '16px',
        ...style 
      }}
    />
  )
}

export function SkeletonText({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton 
          key={i} 
          className="skeleton-text" 
          width={i === lines - 1 ? '70%' : '100%'} 
        />
      ))}
    </div>
  )
}

export function SkeletonCard({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return (
    <div className={`skeleton skeleton-card ${className}`}>
      {children}
    </div>
  )
}

export function SkeletonKPI() {
  return (
    <div className="skeleton-kpi">
      <Skeleton className="skeleton-avatar" width={48} height={48} />
      <div style={{ flex: 1 }}>
        <Skeleton className="skeleton-text-sm" width="40%" style={{ marginBottom: 8 }} />
        <Skeleton className="skeleton-text-lg" width="60%" />
      </div>
    </div>
  )
}

export function SkeletonKPIGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="skeleton-kpi-grid">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonKPI key={i} />
      ))}
    </div>
  )
}

const funMessages = [
  '💰 Contando tus monedas...',
  '📊 Analizando tendencias...',
  '🔮 Prediciendo el futuro...',
  '🚀 Cargando a velocidad luz...',
  '✨ Preparando la magia...',
  '🧮 Haciendo cálculos...',
  '📈 Graficando tu éxito...',
  '💎 Puliendo los datos...'
]

export function PremiumLoader({ message }: { message?: string }) {
  const [funMessage, setFunMessage] = useState(funMessages[0])
  
  useEffect(() => {
    const interval = setInterval(() => {
      setFunMessage(funMessages[Math.floor(Math.random() * funMessages.length)])
    }, 2000)
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

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
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
          <Skeleton key={i} height={12} width="60%" />
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
            <Skeleton key={colIndex} height={14} width={colIndex === 0 ? '80%' : '50%'} />
          ))}
        </div>
      ))}
    </div>
  )
}
