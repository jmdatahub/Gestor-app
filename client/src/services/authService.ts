import { api } from '../lib/apiClient'

export async function ensureDefaultAccountsForUser(_userId: string): Promise<void> {
  const { data: existing } = await api.get<{ data: { id: string }[] }>('/api/v1/accounts')
  if (existing.length > 0) return
  const defaults = [
    { name: 'Cuenta corriente', type: 'bank' },
    { name: 'Efectivo', type: 'cash' },
    { name: 'Ahorro', type: 'savings' },
  ]
  for (const account of defaults) {
    await api.post('/api/v1/accounts', account).catch(() => {})
  }
}
