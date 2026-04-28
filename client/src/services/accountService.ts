import { api } from '../lib/apiClient'
import { invalidateAccounts } from './catalogCache'

export interface Account {
  id: string; user_id: string; organization_id?: string | null; name: string
  type: 'general' | 'savings' | 'cash' | 'bank' | 'broker' | 'other'
  description?: string | null; is_active: boolean; parent_account_id?: string | null
  created_at: string; updated_at: string | null; color?: string | null; icon?: string | null
  currency?: string | null; balance?: number | null
}
export interface AccountWithBalance extends Account { balance: number }
export interface AccountNode extends AccountWithBalance { children: AccountNode[]; level: number }
export interface CreateAccountInput {
  user_id: string; organization_id?: string | null; name: string; type: Account['type']
  description?: string | null; parent_account_id?: string | null
}

export const accountTypes = [
  { value: 'general', label: 'General' }, { value: 'savings', label: 'Ahorro' },
  { value: 'cash', label: 'Efectivo' }, { value: 'bank', label: 'Cuenta Bancaria' },
  { value: 'broker', label: 'Broker / Inversión' }, { value: 'other', label: 'Otra' },
]

export async function getUserAccounts(_userId: string, organizationId?: string | null): Promise<Account[]> {
  const params: Record<string, string> = {}
  if (organizationId) params.org_id = organizationId
  const { data } = await api.get<{ data: Account[] }>('/api/v1/accounts', params)
  return data
}

export async function getAccountById(accountId: string): Promise<AccountWithBalance | null> {
  const { data } = await api.get<{ data: AccountWithBalance }>(`/api/v1/accounts/${accountId}`)
  return data
}

export async function createAccount(input: CreateAccountInput): Promise<Account> {
  const { data } = await api.post<{ data: Account }>('/api/v1/accounts', input)
  invalidateAccounts()
  return data
}

export async function updateAccount(id: string, updates: Partial<Account>): Promise<Account> {
  const { data } = await api.patch<{ data: Account }>(`/api/v1/accounts/${id}`, updates)
  invalidateAccounts()
  return data
}

export async function deleteAccount(id: string): Promise<void> {
  await api.delete(`/api/v1/accounts/${id}`)
  invalidateAccounts()
}

export function buildAccountTree(accounts: AccountWithBalance[]): AccountNode[] {
  const map = new Map<string, AccountNode>()
  accounts.forEach(a => map.set(a.id, { ...a, children: [], level: 0 }))
  const roots: AccountNode[] = []
  map.forEach(node => {
    if (node.parent_account_id && map.has(node.parent_account_id)) {
      const parent = map.get(node.parent_account_id)!
      node.level = parent.level + 1
      parent.children.push(node)
    } else roots.push(node)
  })
  return roots
}

// Backward-compat aliases & helpers

export async function getAccountsWithBalances(_userId: string, organizationId?: string | null): Promise<AccountWithBalance[]> {
  const params: Record<string, string> = {}
  if (organizationId) params.org_id = organizationId
  const { data } = await api.get<{ data: AccountWithBalance[] }>('/api/v1/accounts', params)
  return data
}

export async function fetchAccountsSummary(_userId: string, organizationId?: string | null): Promise<AccountWithBalance[]> {
  return getAccountsWithBalances(_userId, organizationId)
}

export async function toggleAccountActive(id: string, isActive: boolean): Promise<Account> {
  return updateAccount(id, { is_active: isActive })
}

export async function createTransfer(
  userIdOrFromId: string,
  fromOrToId: string,
  toOrAmount: string | number,
  amountOrDate?: number | string,
  dateOrDesc?: string,
  descOrOrgId?: string,
  orgId?: string | null,
): Promise<void> {
  // Support (userId, fromId, toId, amount, date, desc?, orgId?) signature
  let fromAccountId: string, toAccountId: string, amount: number, date: string, description: string | undefined
  if (typeof toOrAmount === 'string') {
    // (userId, fromId, toId, amount, date, desc?, orgId?)
    fromAccountId = fromOrToId
    toAccountId = toOrAmount
    amount = amountOrDate as number
    date = dateOrDesc as string
    description = descOrOrgId
  } else {
    // (fromId, toId, amount, date, desc?)
    fromAccountId = userIdOrFromId
    toAccountId = fromOrToId
    amount = toOrAmount
    date = amountOrDate as string
    description = dateOrDesc
  }
  await api.post('/api/v1/movements/transfer', { from_account_id: fromAccountId, to_account_id: toAccountId, amount, date, description, org_id: orgId })
}

export function flattenAccountTree(nodes: AccountNode[]): AccountNode[] {
  const result: AccountNode[] = []
  const walk = (list: AccountNode[]) => {
    for (const n of list) {
      result.push(n)
      if (n.children.length) walk(n.children)
    }
  }
  walk(nodes)
  return result
}

export function calculateTotalsByType(accounts: AccountWithBalance[]): Record<string, number> {
  return accounts.reduce((acc, a) => {
    acc[a.type] = (acc[a.type] || 0) + (a.balance || 0)
    return acc
  }, {} as Record<string, number>)
}

export function getAccountTypeLabel(type: string): string {
  return accountTypes.find(t => t.value === type)?.label ?? type
}

export async function getRootAccountId(_userId: string, organizationId?: string | null): Promise<string | null> {
  const accounts = await getAccountsWithBalances(_userId, organizationId)
  const root = accounts.find(a => !a.parent_account_id)
  return root?.id ?? null
}

export function validateParentAssignment(
  accountsOrAccountId: Account[] | string,
  accountIdOrParentId: string,
  parentIdOrAccounts?: string | Account[] | null,
): string | null {
  // Support both (accounts[], accountId, parentId) and (accountId, parentId, accounts[])
  let accounts: Account[], accountId: string, parentId: string | null

  if (Array.isArray(accountsOrAccountId)) {
    accounts = accountsOrAccountId
    accountId = accountIdOrParentId
    parentId = typeof parentIdOrAccounts === 'string' ? parentIdOrAccounts : null
  } else {
    accountId = accountsOrAccountId
    parentId = accountIdOrParentId
    accounts = Array.isArray(parentIdOrAccounts) ? parentIdOrAccounts : []
  }

  if (!parentId) return null
  if (accountId === parentId) return 'Una cuenta no puede ser su propio padre'

  // Prevent circular references: check parentId is not a descendant of accountId
  const children = accounts.filter(a => a.parent_account_id === accountId).map(a => a.id)
  if (children.includes(parentId)) return 'Asignación circular: la cuenta seleccionada es hija de esta cuenta'
  for (const childId of children) {
    const childError = validateParentAssignment(accounts, childId, parentId)
    if (childError) return childError
  }
  return null
}
