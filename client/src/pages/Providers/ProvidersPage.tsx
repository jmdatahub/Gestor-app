import { ProvidersSettings } from '../../components/domain/ProvidersSettings'
import { UiCard, UiCardBody } from '../../components/ui/UiCard'
import { Store } from 'lucide-react'

export default function ProvidersPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Store size={20} className="text-primary" />
        <div>
          <h2 className="text-base font-semibold text-foreground">Proveedores</h2>
          <p className="text-xs text-muted-foreground">Gestiona los proveedores disponibles para tus movimientos</p>
        </div>
      </div>
      <UiCard>
        <UiCardBody>
          <ProvidersSettings />
        </UiCardBody>
      </UiCard>
    </div>
  )
}
