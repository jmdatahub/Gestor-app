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

// KPI Card skeleton
export function SkeletonKPI() {
  return (
    <div className="skeleton-card skeleton-kpi">
      <div className="skeleton skeleton-kpi-icon" />
      <div className="skeleton-kpi-content">
        <SkeletonText width="50%" />
        <SkeletonText width="80%" />
      </div>
    </div>
  )
}

// List row skeleton
export function SkeletonRow() {
  return (
    <div className="skeleton-row">
      <div className="skeleton skeleton-avatar" style={{ width: 40, height: 40 }} />
      <div style={{ flex: 1 }}>
        <SkeletonText width="70%" />
        <SkeletonText width="40%" />
      </div>
      <SkeletonText width="80px" />
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
      <div className="kpi-grid">
        <SkeletonKPI />
        <SkeletonKPI />
        <SkeletonKPI />
        <SkeletonKPI />
      </div>

      {/* Content */}
      <div className="section-card" style={{ marginTop: '1.5rem' }}>
        <SkeletonTitle />
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </div>
    </div>
  )
}

// List page skeleton
export function SkeletonList({ rows = 5 }: { rows?: number }) {
  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <SkeletonTitle width="180px" />
          <SkeletonText width="250px" />
        </div>
        <Skeleton className="btn" style={{ width: 140, height: 40 }} />
      </div>

      <div className="card">
        {Array.from({ length: rows }).map((_, i) => (
          <SkeletonRow key={i} />
        ))}
      </div>
    </div>
  )
}
