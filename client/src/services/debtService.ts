import { api } from '../lib/apiClient'

export interface Debt {
  id: string; user_id: string; organization_id?: string | null; title: string
  description?: string | null; total_amount: number; remaining_amount: number
  debt_type: 'owed_to_me' | 'i_owe'; counterparty_name: string
  due_date?: string | null; is_settled: boolean; created_at: string; deleted_at?: string | null
  // Compat fields
  direction?: 'owed_to_me' | 'i_owe' | 'they_owe_me'
  is_closed?: boolean
  amount?: number
}

export interface DebtMovement {
  id: string; debt_id: string; amount: number; date: string; note?: string | null; created_at: string
  type?: string
}

// CreateDebtInput allows partial Debt fields; required fields filled with defaults
export type CreateDebtInput = Partial<Debt> & { user_id: string; counterparty_name: string; total_amount: number }

export async function fetchDebts(_userId: string, organizationId?: string | null): Promise<Debt[]> {
  const params: Record<string, string> = {}
  if (organizationId) params.org_id = organizationId
  const { data } = await api.get<{ data: Debt[] }>('/api/v1/debts', params)
  return data
}

export async function getDebtById(id: string): Promise<Debt | null> {
  const { data } = await api.get<{ data: Debt }>(`/api/v1/debts/${id}`)
  return data
}

export async function createDebt(debt: Omit<Debt, 'id' | 'created_at'> | CreateDebtInput): Promise<Debt> {
  const { data } = await api.post<{ data: Debt }>('/api/v1/debts', debt)
  return data
}

export async function updateDebt(id: string, updates: Partial<Debt>): Promise<Debt> {
  const { data } = await api.patch<{ data: Debt }>(`/api/v1/debts/${id}`, updates)
  return data
}

export async function deleteDebt(id: string): Promise<void> {
  await api.delete(`/api/v1/debts/${id}`)
}

export async function fetchDebtMovements(debtId: string): Promise<DebtMovement[]> {
  const { data } = await api.get<{ data: DebtMovement[] }>(`/api/v1/debts/${debtId}/movements`)
  return data
}

export async function addDebtMovement(
  debtIdOrMovement: string | Omit<DebtMovement, 'id' | 'created_at'>,
  movement?: Omit<DebtMovement, 'id' | 'created_at' | 'debt_id'>,
): Promise<DebtMovement> {
  if (typeof debtIdOrMovement === 'string') {
    const { data } = await api.post<{ data: DebtMovement }>(`/api/v1/debts/${debtIdOrMovement}/movements`, movement)
    return data
  }
  // Single-arg overload: movement object includes debt_id
  const m = debtIdOrMovement
  const { data } = await api.post<{ data: DebtMovement }>(`/api/v1/debts/${m.debt_id}/movements`, {
    amount: m.amount, date: m.date, note: m.note,
  })
  return data
}

export async function countPendingDebts(_userId: string, organizationId?: string | null): Promise<number> {
  const debts = await fetchDebts(_userId, organizationId)
  return debts.filter(d => !d.is_settled).length
}

// ---- Backward-compat aliases & types ----

export const fetchDebtById = getDebtById

// Overload: single-arg version (movement includes debt_id)
export async function addDebtMovementFromObject(movement: Omit<DebtMovement, 'id' | 'created_at'>): Promise<DebtMovement> {
  return addDebtMovement(movement.debt_id, {
    amount: movement.amount,
    date: movement.date,
    note: movement.note,
  })
}
