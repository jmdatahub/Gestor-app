import { supabase } from '../lib/supabaseClient'
import { invalidateAccounts } from './catalogCache'

// Types
export interface Account {
  id: string
  user_id: string
  organization_id?: string | null // [NEW] Multi-Workspace support
  name: string
  type: 'general' | 'savings' | 'cash' | 'bank' | 'broker' | 'other'
  description?: string | null
  is_active: boolean
  parent_account_id?: string | null
  created_at: string
  updated_at: string | null
}

export interface AccountWithBalance extends Account {
  balance: number
}

export interface AccountNode extends AccountWithBalance {
  children: AccountNode[]
  level: number
}

export interface CreateAccountInput {
  user_id: string
  organization_id?: string | null // [NEW] Optional
  name: string
  type: Account['type']
  description?: string | null
  parent_account_id?: string | null
}

export const accountTypes = [
  { value: 'general', label: 'General' },
  { value: 'savings', label: 'Ahorro' },
  { value: 'cash', label: 'Efectivo' },
  { value: 'bank', label: 'Cuenta Bancaria' },
  { value: 'broker', label: 'Broker / Inversión' },
  { value: 'other', label: 'Otra' }
]

// Get all accounts for user (OR Organization)
export async function getUserAccounts(userId: string, organizationId?: string | null): Promise<Account[]> {
  let query = supabase
    .from('accounts')
    .select('*')
    .order('created_at', { ascending: true })

  if (organizationId) {
    query = query.eq('organization_id', organizationId)
  } else {
    query = query.eq('user_id', userId).is('organization_id', null)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching accounts:', error)
    throw error
  }
  return data || []
}

// Get single account by ID
export async function getAccountById(accountId: string): Promise<AccountWithBalance | null> {
  // ID is unique, so no need for strict Org filter here, but RLS will handle visibility
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('id', accountId)
    .single()

  if (error) {
    console.error('Error fetching account:', error)
    throw error
  }
  
  return data ? { ...data, balance: 0 } : null
}

// Get active accounts only
export async function getActiveAccounts(userId: string, organizationId?: string | null): Promise<Account[]> {
  let query = supabase
    .from('accounts')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (organizationId) {
    query = query.eq('organization_id', organizationId)
  } else {
    query = query.eq('user_id', userId).is('organization_id', null)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching active accounts:', error)
    throw error
  }
  return data || []
}

// Helper: Build Tree
export function buildAccountTree(accounts: AccountWithBalance[]): AccountNode[] {
  const map = new Map<string, AccountNode>()
  // Initialize map
  accounts.forEach(a => map.set(a.id, { ...a, children: [], level: 0 }))
  
  const roots: AccountNode[] = []
  
  accounts.forEach(a => {
    const node = map.get(a.id)!
    // Use renamed property parent_account_id
    if (a.parent_account_id && map.has(a.parent_account_id)) {
      const parent = map.get(a.parent_account_id)!
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  })
  
  return roots
}

// Helper: Flatten Tree
export function flattenAccountTree(nodes: AccountNode[], level = 0): AccountNode[] {
  let result: AccountNode[] = []
  // Sort by name for display consistency
  const sortedNodes = [...nodes].sort((a, b) => a.name.localeCompare(b.name))
  
  sortedNodes.forEach(node => {
    node.level = level
    result.push(node)
    if (node.children.length > 0) {
      result = result.concat(flattenAccountTree(node.children, level + 1))
    }
  })
  return result
}

// Helper: Validate Parent (Anti-cycle)
export function validateParentAssignment(allAccounts: Account[], accountId: string, newParentId: string | null): string | null {
  if (!newParentId) return null // No parent is always valid
  if (accountId === newParentId) return 'Una cuenta no puede ser su propio padre.'

  // Build temporary map for traversal
  const map = new Map<string, string | null>()
  allAccounts.forEach(a => map.set(a.id, a.parent_account_id || null))

  // Check if newParentId is a descendant of accountId
  let currentId: string | null = newParentId
  while (currentId) {
    if (currentId === accountId) return 'No se puede asignar una cuenta hija como padre (ciclo detectado).'
    currentId = map.get(currentId) || null
  }

  return null
}

// Create new account
export async function createAccount(input: CreateAccountInput): Promise<Account> {
  const { data, error } = await supabase
    .from('accounts')
    .insert([{
      ...input,
      organization_id: input.organization_id || null, // Explicit null
      is_active: true
    }])
    .select()
    .single()

  if (error) {
    console.error('Error creating account:', error)
    throw error
  }
  invalidateAccounts(input.user_id)
  return data
}

// Update account
export async function updateAccount(accountId: string, updates: Partial<Account>): Promise<Account> {
  const { data, error } = await supabase
    .from('accounts')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', accountId)
    .select()
    .single()

  if (error) {
    console.error('Error updating account:', error)
    throw error
  }
  invalidateAccounts() // Ideally, we'd know which context to invalidate, but generic global invalidate is safe for now
  return data
}

// Delete account permanently
export async function deleteAccount(accountId: string): Promise<void> {
  console.log('[accountService] Deleting account:', accountId)
  
  const { error } = await supabase
    .from('accounts')
    .delete()
    .eq('id', accountId)

  if (error) {
    console.error('Error deleting account:', error)
    throw error
  }
  
  console.log('[accountService] Account deleted:', accountId)
  invalidateAccounts()
}

// Toggle account active status
export async function toggleAccountActive(accountId: string, isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from('accounts')
    .update({
      is_active: isActive,
      updated_at: new Date().toISOString()
    })
    .eq('id', accountId)

  if (error) {
    console.error('Error toggling account active:', error)
    throw error
  }
  invalidateAccounts()
}

// Calculate balance for a single account
export async function calculateAccountBalance(accountId: string): Promise<number> {
  const { data: movements, error } = await supabase
    .from('movements')
    .select('kind, amount')
    .eq('account_id', accountId)

  if (error) {
    console.error('Error fetching movements for balance:', error)
    return 0
  }

  let balance = 0
  for (const m of (movements || [])) {
    if (m.kind === 'income' || m.kind === 'transfer_in') {
      balance += m.amount
    } else {
      // expense, investment, transfer_out
      balance -= m.amount
    }
  }
  return balance
}

// Get all accounts with balances
export async function getAccountsWithBalances(userId: string, organizationId?: string | null): Promise<AccountWithBalance[]> {
  const accounts = await getUserAccounts(userId, organizationId)
  
  // Get all movements for this user / Org
  let query = supabase
    .from('movements')
    .select('account_id, kind, amount')

  if (organizationId) {
    query = query.eq('organization_id', organizationId)
  } else {
    query = query.eq('user_id', userId).is('organization_id', null)
  }

  const { data: movements } = await query

  // Calculate balances
  const balanceMap: Record<string, number> = {}
  for (const m of (movements || [])) {
    if (!balanceMap[m.account_id]) balanceMap[m.account_id] = 0
    
    if (m.kind === 'income' || m.kind === 'transfer_in') {
      balanceMap[m.account_id] += m.amount
    } else {
      // expense, investment, transfer_out
      balanceMap[m.account_id] -= m.amount
    }
  }

  return accounts.map(acc => ({
    ...acc,
    balance: balanceMap[acc.id] || 0
  }))
}

// Create internal transfer between accounts
export async function createTransfer(
  userId: string,
  fromAccountId: string,
  toAccountId: string,
  amount: number,
  date: string,
  description?: string
): Promise<void> {
  // Create two movements: one outgoing, one incoming
  const transferDescription = description || 'Transferencia interna'
  
  const { error } = await supabase
    .from('movements')
    .insert([
      {
        user_id: userId,
        account_id: fromAccountId,
        kind: 'transfer_out',
        amount: amount,
        date: date,
        description: transferDescription,
        status: 'confirmed',
        related_account_id: toAccountId
      },
      {
        user_id: userId,
        account_id: toAccountId,
        kind: 'transfer_in',
        amount: amount,
        date: date,
        description: transferDescription,
        status: 'confirmed',
        related_account_id: fromAccountId
      }
    ])

  if (error) {
    console.error('Error creating transfer:', error)
    throw error
  }
}

// Get type label
export function getAccountTypeLabel(type: string): string {
  return accountTypes.find(t => t.value === type)?.label || type
}

// Calculate totals by type
export function calculateTotalsByType(accounts: AccountWithBalance[]) {
  const total = accounts.reduce((sum, acc) => sum + acc.balance, 0)
  const savings = accounts.filter(a => a.type === 'savings').reduce((sum, acc) => sum + acc.balance, 0)
  const broker = accounts.filter(a => a.type === 'broker').reduce((sum, acc) => sum + acc.balance, 0)
  const activeCount = accounts.filter(a => a.is_active).length
  
  return { total, savings, broker, activeCount, count: accounts.length }
}

// Get account summary (total balance + count)
export async function fetchAccountsSummary(userId: string, organizationId?: string | null) {
  const accounts = await getAccountsWithBalances(userId, organizationId)
  return {
    totalBalance: accounts.reduce((sum, acc) => sum + acc.balance, 0),
    accountCount: accounts.filter(a => a.is_active).length
  }
}

// Helper: Build Descendants Map (parent -> Set of all descendants)
export function buildDescendantsMap(accounts: Account[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>()
  const childrenMap = new Map<string, string[]>()
  
  // Initialize maps
  accounts.forEach(a => {
    map.set(a.id, new Set())
    if (a.parent_account_id) {
      if (!childrenMap.has(a.parent_account_id)) {
        childrenMap.set(a.parent_account_id, [])
      }
      childrenMap.get(a.parent_account_id)!.push(a.id)
    }
  })

  // Recursive function to get all descendants
  function getDescendants(accountId: string): Set<string> {
    const descendants = new Set<string>()
    const directChildren = childrenMap.get(accountId) || []
    
    for (const childId of directChildren) {
      descendants.add(childId)
      const grandChildren = getDescendants(childId)
      grandChildren.forEach(gc => descendants.add(gc))
    }
    return descendants
  }

  // Build full map
  accounts.forEach(a => {
    map.set(a.id, getDescendants(a.id))
  })

  return map
}

// Helper: Get Root Account ID
export function getRootAccountId(accounts: Account[], accountId: string): string {
    const account = accounts.find(a => a.id === accountId);
    if (!account || !account.parent_account_id) return accountId; // If no account or no parent, it is the root
    
    let current = account;
    const visited = new Set<string>();
    visited.add(current.id);

    while (current.parent_account_id) {
        const parent = accounts.find(a => a.id === current.parent_account_id);
        if (!parent) break; // Should not happen if data is consistent
        if (visited.has(parent.id)) break; // Cycle protection
        current = parent;
        visited.add(current.id);
    }
    return current.id;
}

