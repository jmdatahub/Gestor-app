import { api } from '../lib/apiClient'

export interface PaymentMethod { id: string; user_id: string; name: string; type: string; is_default: boolean; created_at: string }

export async function fetchPaymentMethods(_userId: string, _orgId?: string | null): Promise<PaymentMethod[]> {
  const { data } = await api.get<{ data: PaymentMethod[] }>('/api/v1/payment-methods')
  return data
}

// Overloaded: supports (pm: Partial<PaymentMethod>) or (userId: string, name: string)
export async function createPaymentMethod(
  pmOrUserId: Omit<PaymentMethod, 'id' | 'created_at'> | string,
  name?: string,
): Promise<PaymentMethod> {
  let payload: Omit<PaymentMethod, 'id' | 'created_at'>
  if (typeof pmOrUserId === 'string') {
    payload = { user_id: pmOrUserId, name: name ?? '', type: 'other', is_default: false }
  } else {
    payload = pmOrUserId
  }
  const { data } = await api.post<{ data: PaymentMethod }>('/api/v1/payment-methods', payload)
  return data
}

export async function updatePaymentMethod(id: string, updates: Partial<PaymentMethod>): Promise<PaymentMethod> {
  const { data } = await api.patch<{ data: PaymentMethod }>(`/api/v1/payment-methods/${id}`, updates)
  return data
}

export async function deletePaymentMethod(id: string): Promise<boolean> {
  try {
    await api.delete(`/api/v1/payment-methods/${id}`)
    return true
  } catch { return false }
}

// ---- Backward-compat aliases & helpers ----
export const getPaymentMethods = fetchPaymentMethods

export async function setDefaultPaymentMethod(_userId: string, id: string): Promise<PaymentMethod> {
  return updatePaymentMethod(id, { is_default: true })
}

export async function initializeDefaultPaymentMethods(_userId: string): Promise<void> {
  // No-op: defaults are managed server-side
}
