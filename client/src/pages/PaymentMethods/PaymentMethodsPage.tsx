import { PaymentMethodsSettings } from '../../components/domain/PaymentMethodsSettings'
import { UiCard, UiCardBody } from '../../components/ui/UiCard'
import { CreditCard } from 'lucide-react'

export default function PaymentMethodsPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <CreditCard size={20} className="text-primary" />
        <div>
          <h2 className="text-base font-semibold text-foreground">Métodos de pago</h2>
          <p className="text-xs text-muted-foreground">Gestiona los métodos de pago disponibles para tus movimientos</p>
        </div>
      </div>
      <UiCard>
        <UiCardBody>
          <PaymentMethodsSettings />
        </UiCardBody>
      </UiCard>
    </div>
  )
}
