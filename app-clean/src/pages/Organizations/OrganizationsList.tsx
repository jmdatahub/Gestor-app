import { useI18n } from '../../hooks/useI18n'

export default function OrganizationsList() {
  const { t } = useI18n()

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Mis Organizaciones</h1>
          <p className="page-subtitle">Gestiona tus empresas y espacios de trabajo</p>
        </div>
      </div>

      {/* Placeholder Content */}
      <div className="p-8 text-center text-secondary">
        <p>Contenido de organizaciones próximamente...</p>
      </div>
    </div>
  )
}
