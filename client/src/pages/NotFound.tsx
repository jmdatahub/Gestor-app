import { useNavigate } from 'react-router-dom'

export default function NotFound() {
  const navigate = useNavigate()

  return (
    <div
      className="page-container fade-in"
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}
    >
      <div className="panel" style={{ maxWidth: 480, width: '100%', margin: '0 auto' }}>
        <div className="panel-body" style={{ textAlign: 'center', padding: 48 }}>
          <p style={{ fontSize: 72, fontWeight: 800, color: 'var(--primary)', lineHeight: 1, marginBottom: 8 }}>
            404
          </p>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>Página no encontrada</h1>
          <p className="text-muted" style={{ marginBottom: 32 }}>
            La ruta que buscas no existe o fue movida.
          </p>
          <button
            className="btn btn-primary"
            onClick={() => navigate('/app/dashboard', { replace: true })}
            type="button"
          >
            Ir al inicio
          </button>
        </div>
      </div>
    </div>
  )
}
