import ExcelJS from 'exceljs'
import { supabase } from '../lib/supabaseClient'
import { buildAccountTree, flattenAccountTree, getUserAccounts, type Account } from './accountService'
import { getAccountBalancesSummary } from './summaryService'

// ========================================
// Utility functions
// ========================================

export function downloadFile(buffer: Blob | ArrayBuffer | string, filename: string, mimeType: string) {
  const blob = buffer instanceof Blob ? buffer : new Blob([buffer], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function arrayToCSV(data: Record<string, unknown>[], headers: string[]): string {
  if (data.length === 0) return headers.join(',') + '\n'
  
  const rows = data.map(row => 
    headers.map(h => {
      const val = row[h]
      if (val === null || val === undefined) return ''
      const str = String(val)
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }).join(',')
  )
  
  return [headers.join(','), ...rows].join('\n')
}

// Helpers for Account Paths
// ----------------------------------------------------------------------
function buildAccountPathMap(accounts: any[]): Map<string, string> {
  const pathMap = new Map<string, string>()
  const accountMap = new Map<string, any>()
  accounts.forEach(a => accountMap.set(a.id, a))

  accounts.forEach(a => {
    const p: string[] = []
    let curr = a
    while (curr) {
      p.unshift(curr.name)
      if (curr.parent_account_id) {
        curr = accountMap.get(curr.parent_account_id)
      } else {
        curr = null
      }
    }
    pathMap.set(a.id, p.join(' / '))
  })
  return pathMap
}

// ========================================
// Generic JSON Export
// ========================================

export async function exportToJSON(data: any[], filename: string) {
  const json = JSON.stringify(data, null, 2)
  downloadFile(json, filename, 'application/json')
  return data.length
}

// ========================================
// Movements Export
// ========================================

interface MovementFilters {
  startDate?: string
  endDate?: string
  type?: 'income' | 'expense' | 'investment' | 'all'
}

export async function exportMovementsToCSV(userId: string, filters: MovementFilters = {}) {
  let query = supabase
    .from('movements')
    .select(`
      id, date, type, amount, description, category, status, created_at,
      account:accounts(name)
    `)
    .eq('user_id', userId)
    .order('date', { ascending: false })

  if (filters.startDate) query = query.gte('date', filters.startDate)
  if (filters.endDate) query = query.lte('date', filters.endDate)
  if (filters.type && filters.type !== 'all') query = query.eq('type', filters.type)

  const { data, error } = await query
  if (error) throw error

  const rows = (data || []).map(m => ({
    id: m.id,
    date: m.date,
    type: m.type,
    amount: m.amount,
    account_name: Array.isArray(m.account) ? m.account[0]?.name : (m.account as any)?.name || '',
    category: m.category || '',
    description: m.description || '',
    status: m.status || 'confirmed',
    created_at: m.created_at
  }))

  const csv = arrayToCSV(rows, ['id', 'date', 'type', 'amount', 'account_name', 'category', 'description', 'status', 'created_at'])
  downloadFile(csv, 'movements.csv', 'text/csv;charset=utf-8;')
  return rows.length
}

export async function exportMovementsToExcel(userId: string, filters: MovementFilters = {}) {
  let query = supabase
    .from('movements')
    .select(`
      id, date, type, amount, description, category, status, created_at,
      account:accounts(name)
    `)
    .eq('user_id', userId)
    .order('date', { ascending: false })

  if (filters.startDate) query = query.gte('date', filters.startDate)
  if (filters.endDate) query = query.lte('date', filters.endDate)
  if (filters.type && filters.type !== 'all') query = query.eq('type', filters.type)

  const { data, error } = await query
  if (error) throw error

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Movements')
  
  sheet.columns = [
    { header: 'ID', key: 'id', width: 36 },
    { header: 'Fecha', key: 'date', width: 12 },
    { header: 'Tipo', key: 'type', width: 12 },
    { header: 'Importe', key: 'amount', width: 12 },
    { header: 'Cuenta', key: 'account_name', width: 20 },
    { header: 'Categoría', key: 'category', width: 15 },
    { header: 'Descripción', key: 'description', width: 30 },
    { header: 'Estado', key: 'status', width: 12 },
    { header: 'Creado', key: 'created_at', width: 20 },
  ]

  ;(data || []).forEach(m => {
    sheet.addRow({
      id: m.id,
      date: m.date,
      type: m.type,
      amount: m.amount,
      account_name: Array.isArray(m.account) ? m.account[0]?.name : (m.account as any)?.name || '',
      category: m.category || '',
      description: m.description || '',
      status: m.status || 'confirmed',
      created_at: m.created_at
    })
  })

  const buffer = await workbook.xlsx.writeBuffer()
  downloadFile(buffer, 'movements.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  return (data || []).length
}

export async function exportMovementsToJSON(userId: string, filters: MovementFilters = {}) {
  let query = supabase
    .from('movements')
    .select(`
      id, date, type, amount, description, category, status, created_at,
      account:accounts(name)
    `)
    .eq('user_id', userId)
    .order('date', { ascending: false })

  if (filters.startDate) query = query.gte('date', filters.startDate)
  if (filters.endDate) query = query.lte('date', filters.endDate)
  if (filters.type && filters.type !== 'all') query = query.eq('type', filters.type)

  const { data, error } = await query
  if (error) throw error

  return exportToJSON(data || [], 'movements.json')
}

// ========================================
// Accounts Export
// ========================================

export async function exportAccountsToCSV(userId: string) {
  const { data, error } = await supabase
    .from('accounts')
    .select('id, name, type, created_at')
    .eq('user_id', userId)

  if (error) throw error

  const csv = arrayToCSV(data || [], ['id', 'name', 'type', 'created_at'])
  downloadFile(csv, 'accounts.csv', 'text/csv;charset=utf-8;')
  return (data || []).length
}

export async function exportAccountsToExcel(userId: string) {
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('user_id', userId)

  if (error) throw error

  // Flatten hierarchy for proper info
  // We cast to any for buildAccountTree
  const tree = buildAccountTree(data as any)
  const flat = flattenAccountTree(tree) // Adds 'level'

  // Map to add parents
  const accountMap = new Map<string, any>()
  data.forEach(a => accountMap.set(a.id, a))

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Accounts')
  
  sheet.columns = [
    { header: 'ID', key: 'id', width: 36 },
    { header: 'Nombre', key: 'name', width: 25 },
    { header: 'Tipo', key: 'type', width: 15 },
    { header: 'Nivel', key: 'level', width: 10 },
    { header: 'Padre', key: 'parent_name', width: 25 },
    { header: 'Creado', key: 'created_at', width: 20 },
  ]

  flat.forEach(a => {
    let parentName = ''
    if (a.parent_account_id && accountMap.has(a.parent_account_id)) {
      parentName = accountMap.get(a.parent_account_id).name
    }
    sheet.addRow({
      id: a.id,
      name: a.name, // Indentation? Maybe visual only. Keep clean name for data.
      type: a.type,
      level: a.level,
      parent_name: parentName,
      created_at: a.created_at
    })
  })

  const buffer = await workbook.xlsx.writeBuffer()
  downloadFile(buffer, 'accounts.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  return (data || []).length
}

export async function exportAccountsToJSON(userId: string) {
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('user_id', userId)
  if (error) throw error
  return exportToJSON(data || [], 'accounts.json')
}

// ========================================
// Categories Export
// ========================================

export async function exportCategoriesToCSV(userId: string) {
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, type, created_at')
    .eq('user_id', userId)

  if (error) {
    // Categories might not exist
    console.warn('Categories table might not exist:', error)
    return 0
  }

  const csv = arrayToCSV(data || [], ['id', 'name', 'type', 'created_at'])
  downloadFile(csv, 'categories.csv', 'text/csv;charset=utf-8;')
  return (data || []).length
}

export async function exportCategoriesToExcel(userId: string) {
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, type, created_at')
    .eq('user_id', userId)

  if (error && error.code !== '42P01') throw error // Ignore table not found if that was the logic

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Categories')
  
  sheet.columns = [
    { header: 'ID', key: 'id', width: 36 },
    { header: 'Nombre', key: 'name', width: 25 },
    { header: 'Tipo', key: 'type', width: 15 },
    { header: 'Creado', key: 'created_at', width: 20 },
  ]

  ;(data || []).forEach(c => sheet.addRow(c))

  const buffer = await workbook.xlsx.writeBuffer()
  downloadFile(buffer, 'categories.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  return (data || []).length
}

export async function exportCategoriesToJSON(userId: string) {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', userId)
  if (error) return 0
  return exportToJSON(data || [], 'categories.json')
}

// ========================================
// Savings Export
// ========================================

export async function exportSavingsToExcel(userId: string) {
  const { data: goals, error: goalsError } = await supabase
    .from('savings_goals')
    .select('*')
    .eq('user_id', userId)

  if (goalsError) throw goalsError

  const { data: contributions, error: contribError } = await supabase
    .from('savings_goal_contributions')
    .select('*')
    .eq('user_id', userId)

  if (contribError) throw contribError

  const workbook = new ExcelJS.Workbook()
  
  // Goals sheet
  const goalsSheet = workbook.addWorksheet('Goals')
  goalsSheet.columns = [
    { header: 'ID', key: 'id', width: 36 },
    { header: 'Nombre', key: 'name', width: 25 },
    { header: 'Objetivo', key: 'target_amount', width: 12 },
    { header: 'Actual', key: 'current_amount', width: 12 },
    { header: 'Fecha Objetivo', key: 'due_date', width: 15 },
    { header: 'Descripción', key: 'description', width: 30 },
    { header: 'Completado', key: 'is_completed', width: 12 },
    { header: 'Creado', key: 'created_at', width: 20 },
  ]
  ;(goals || []).forEach(g => goalsSheet.addRow(g))

  // Contributions sheet
  const contribSheet = workbook.addWorksheet('Contributions')
  contribSheet.columns = [
    { header: 'ID', key: 'id', width: 36 },
    { header: 'Goal ID', key: 'goal_id', width: 36 },
    { header: 'Importe', key: 'amount', width: 12 },
    { header: 'Fecha', key: 'date', width: 12 },
    { header: 'Nota', key: 'note', width: 30 },
    { header: 'Creado', key: 'created_at', width: 20 },
  ]
  ;(contributions || []).forEach(c => contribSheet.addRow(c))

  const buffer = await workbook.xlsx.writeBuffer()
  downloadFile(buffer, 'savings.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  return (goals || []).length
}

// ========================================
// Debts Export
// ========================================

export async function exportDebtsToExcel(userId: string) {
  const { data: debts, error: debtsError } = await supabase
    .from('debts')
    .select('*')
    .eq('user_id', userId)

  if (debtsError) throw debtsError

  const { data: movements, error: movError } = await supabase
    .from('debt_movements')
    .select('*')
    .eq('user_id', userId)

  if (movError) throw movError

  const workbook = new ExcelJS.Workbook()
  
  // Debts sheet
  const debtsSheet = workbook.addWorksheet('Debts')
  debtsSheet.columns = [
    { header: 'ID', key: 'id', width: 36 },
    { header: 'Dirección', key: 'direction', width: 15 },
    { header: 'Contraparte', key: 'counterparty_name', width: 20 },
    { header: 'Total', key: 'total_amount', width: 12 },
    { header: 'Pendiente', key: 'remaining_amount', width: 12 },
    { header: 'Vencimiento', key: 'due_date', width: 12 },
    { header: 'Descripción', key: 'description', width: 30 },
    { header: 'Cerrada', key: 'is_closed', width: 10 },
    { header: 'Creado', key: 'created_at', width: 20 },
  ]
  ;(debts || []).forEach(d => debtsSheet.addRow(d))

  // Debt Movements sheet
  const movSheet = workbook.addWorksheet('DebtMovements')
  movSheet.columns = [
    { header: 'ID', key: 'id', width: 36 },
    { header: 'Debt ID', key: 'debt_id', width: 36 },
    { header: 'Tipo', key: 'type', width: 12 },
    { header: 'Importe', key: 'amount', width: 12 },
    { header: 'Fecha', key: 'date', width: 12 },
    { header: 'Nota', key: 'note', width: 30 },
    { header: 'Creado', key: 'created_at', width: 20 },
  ]
  ;(movements || []).forEach(m => movSheet.addRow(m))

  const buffer = await workbook.xlsx.writeBuffer()
  downloadFile(buffer, 'debts.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  return (debts || []).length
}

// ========================================
// Recurring Rules Export
// ========================================

export async function exportRecurringToCSV(userId: string) {
  const { data, error } = await supabase
    .from('recurring_rules')
    .select(`
      id, kind, amount, frequency, day_of_week, day_of_month, 
      next_occurrence, is_active, category, description, created_at,
      account:accounts(name)
    `)
    .eq('user_id', userId)

  if (error) throw error

  const rows = (data || []).map(r => ({
    id: r.id,
    kind: r.kind,
    amount: r.amount,
    frequency: r.frequency,
    day_of_week: r.day_of_week,
    day_of_month: r.day_of_month,
    next_occurrence: r.next_occurrence,
    is_active: r.is_active,
    category: r.category || '',
    account_name: Array.isArray(r.account) ? r.account[0]?.name : (r.account as any)?.name || '',
    description: r.description || '',
    created_at: r.created_at
  }))

  const csv = arrayToCSV(rows, ['id', 'kind', 'amount', 'frequency', 'day_of_week', 'day_of_month', 'next_occurrence', 'is_active', 'category', 'account_name', 'description', 'created_at'])
  downloadFile(csv, 'recurring_rules.csv', 'text/csv;charset=utf-8;')
  return rows.length
}

export async function exportRecurringToExcel(userId: string) {
  const { data, error } = await supabase
    .from('recurring_rules')
    .select(`
      id, kind, amount, frequency, day_of_week, day_of_month, 
      next_occurrence, is_active, category, description, created_at,
      account:accounts(name)
    `)
    .eq('user_id', userId)

  if (error) throw error

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('RecurringRules')
  
  sheet.columns = [
    { header: 'ID', key: 'id', width: 36 },
    { header: 'Tipo', key: 'kind', width: 12 },
    { header: 'Importe', key: 'amount', width: 12 },
    { header: 'Frecuencia', key: 'frequency', width: 12 },
    { header: 'Día Semana', key: 'day_of_week', width: 12 },
    { header: 'Día Mes', key: 'day_of_month', width: 12 },
    { header: 'Próxima', key: 'next_occurrence', width: 15 },
    { header: 'Activa', key: 'is_active', width: 10 },
    { header: 'Categoría', key: 'category', width: 15 },
    { header: 'Cuenta', key: 'account_name', width: 20 },
    { header: 'Descripción', key: 'description', width: 30 },
    { header: 'Creado', key: 'created_at', width: 20 },
  ]

  ;(data || []).forEach(r => {
    sheet.addRow({
      ...r,
      account_name: Array.isArray(r.account) ? r.account[0]?.name : (r.account as any)?.name || ''
    })
  })

  const buffer = await workbook.xlsx.writeBuffer()
  downloadFile(buffer, 'recurring_rules.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  return (data || []).length
}

// ========================================
// Export ALL to Excel
// ========================================

interface ExportAllOptions {
  includeChildrenRollup?: boolean
}

export async function exportAllToExcel(userId: string, options: ExportAllOptions = {}) {
  const workbook = new ExcelJS.Workbook()

  // 1. Fetch Accounts with full data (for path building)
  const allAccounts = await getUserAccounts(userId)
  const pathMap = buildAccountPathMap(allAccounts)

  // 2. Movements
  const { data: movements } = await supabase
    .from('movements')
    .select('*, account:accounts(name)')
    .eq('user_id', userId)
    .order('date', { ascending: false })

  const movSheet = workbook.addWorksheet('Movements')
  movSheet.columns = [
    { header: 'ID', key: 'id', width: 36 },
    { header: 'Fecha', key: 'date', width: 12 },
    { header: 'Tipo', key: 'type', width: 12 },
    { header: 'Importe', key: 'amount', width: 12 },
    { header: 'Cuenta (Ruta)', key: 'account_path', width: 30 }, // Changed from name to path or name
    { header: 'Cuenta (Nombre)', key: 'account_name', width: 20 },
    { header: 'Categoría', key: 'category', width: 15 },
    { header: 'Descripción', key: 'description', width: 30 },
    { header: 'Estado', key: 'status', width: 12 },
  ]
  ;(movements || []).forEach(m => {
    // Determine account path if possible
    let accPath = ''
    if (m.account_id && pathMap.has(m.account_id)) {
      accPath = pathMap.get(m.account_id)!
    }

    movSheet.addRow({
      ...m,
      account_path: accPath,
      account_name: Array.isArray(m.account) ? m.account[0]?.name : (m.account as any)?.name || ''
    })
  })

  // 3. Accounts (Summary)
  // Use summaryService to specific logic (roll-up or clean list)
  const accountsData = await getAccountBalancesSummary(userId, { includeChildrenRollup: options.includeChildrenRollup })
  
  // Re-build hierarchy data for this set (if not rolled up, we want levels)
  // If rolled up, it's flat roots.
  
  const accSheet = workbook.addWorksheet('Accounts')
  accSheet.columns = [
    { header: 'ID', key: 'id', width: 36 },
    { header: 'Nombre', key: 'name', width: 20 },
    { header: 'Ruta Completa', key: 'path', width: 30 },
    { header: 'Tipo', key: 'type', width: 15 },
    { header: 'Balance', key: 'balance', width: 15 },
    { header: 'Nivel', key: 'level', width: 10 },
    { header: 'Es Agrupado', key: 'is_grouped', width: 12 },
  ]

  // If roll-up is ON, we only have roots.
  // If roll-up is OFF, we have all accounts.
  // We can just dump them. 'buildAccountPathMap' expects full list to build paths.
  // Since 'accountsData' might be partial (roots only), pathMap might fail if we use it directly on partial data?
  // No, if we pass partial list to map builder, it will just not find parents.
  // Actually, we already have 'pathMap' from 'allAccounts' fetched above. We can use that.
  
  accountsData.forEach(a => {
    // Calculate level if possible, or use 0
    let level = 0
    let parent = allAccounts.find(acc => acc.id === a.id)?.parent_account_id
    // Simple level calc
    while(parent) {
       level++
       parent = allAccounts.find(acc => acc.id === parent)?.parent_account_id
    }

    accSheet.addRow({
      id: a.id,
      name: a.name,
      path: pathMap.get(a.id) || a.name,
      type: a.type,
      balance: a.balance,
      level: level,
      is_grouped: options.includeChildrenRollup ? 'Sí' : 'No'
    })
  })


  // Savings Goals
  const { data: goals } = await supabase
    .from('savings_goals')
    .select('*')
    .eq('user_id', userId)

  const goalsSheet = workbook.addWorksheet('SavingsGoals')
  goalsSheet.columns = [
    { header: 'ID', key: 'id', width: 36 },
    { header: 'Nombre', key: 'name', width: 25 },
    { header: 'Objetivo', key: 'target_amount', width: 12 },
    { header: 'Actual', key: 'current_amount', width: 12 },
    { header: 'Completado', key: 'is_completed', width: 12 },
  ]
  ;(goals || []).forEach(g => goalsSheet.addRow(g))

  // Savings Contributions
  const { data: contributions } = await supabase
    .from('savings_goal_contributions')
    .select('*')
    .eq('user_id', userId)

  const contribSheet = workbook.addWorksheet('SavingsContributions')
  contribSheet.columns = [
    { header: 'ID', key: 'id', width: 36 },
    { header: 'Goal ID', key: 'goal_id', width: 36 },
    { header: 'Importe', key: 'amount', width: 12 },
    { header: 'Fecha', key: 'date', width: 12 },
    { header: 'Nota', key: 'note', width: 30 },
  ]
  ;(contributions || []).forEach(c => contribSheet.addRow(c))

  // Debts
  const { data: debts } = await supabase
    .from('debts')
    .select('*')
    .eq('user_id', userId)

  const debtsSheet = workbook.addWorksheet('Debts')
  debtsSheet.columns = [
    { header: 'ID', key: 'id', width: 36 },
    { header: 'Dirección', key: 'direction', width: 15 },
    { header: 'Contraparte', key: 'counterparty_name', width: 20 },
    { header: 'Total', key: 'total_amount', width: 12 },
    { header: 'Pendiente', key: 'remaining_amount', width: 12 },
    { header: 'Cerrada', key: 'is_closed', width: 10 },
  ]
  ;(debts || []).forEach(d => debtsSheet.addRow(d))

  // Debt Movements
  const { data: debtMov } = await supabase
    .from('debt_movements')
    .select('*')
    .eq('user_id', userId)

  const debtMovSheet = workbook.addWorksheet('DebtMovements')
  debtMovSheet.columns = [
    { header: 'ID', key: 'id', width: 36 },
    { header: 'Debt ID', key: 'debt_id', width: 36 },
    { header: 'Tipo', key: 'type', width: 12 },
    { header: 'Importe', key: 'amount', width: 12 },
    { header: 'Fecha', key: 'date', width: 12 },
  ]
  ;(debtMov || []).forEach(m => debtMovSheet.addRow(m))

  // Recurring Rules
  const { data: recurring } = await supabase
    .from('recurring_rules')
    .select('*, account:accounts(name)')
    .eq('user_id', userId)

  const recSheet = workbook.addWorksheet('RecurringRules')
  recSheet.columns = [
    { header: 'ID', key: 'id', width: 36 },
    { header: 'Tipo', key: 'kind', width: 12 },
    { header: 'Importe', key: 'amount', width: 12 },
    { header: 'Frecuencia', key: 'frequency', width: 12 },
    { header: 'Próxima', key: 'next_occurrence', width: 12 },
    { header: 'Activa', key: 'is_active', width: 10 },
    { header: 'Cuenta', key: 'account_name', width: 20 },
  ]
  ;(recurring || []).forEach(r => {
    recSheet.addRow({
      ...r,
      account_name: (r.account as { name: string } | null)?.name || ''
    })
  })

  // Determine filename
  const filename = options.includeChildrenRollup 
    ? 'export_completo_agrupado.xlsx' 
    : 'export_completo.xlsx'

  const buffer = await workbook.xlsx.writeBuffer()
  downloadFile(buffer, filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
}

// ========================================
// Summary Export (Contextual - what you see = what you download)
// ========================================

export interface SummaryExportOptions {
  mode: 'monthly' | 'yearly'
  year: number
  month?: number // Only for monthly
}

export interface SummaryData {
  income: number
  expenses: number
  net: number
  savingsChange: number
}

export interface CategoryData {
  categoryName: string
  total: number
}

export async function exportSummaryToExcel(
  userId: string, 
  options: SummaryExportOptions,
  summaryData: SummaryData,
  categoriesData: CategoryData[]
) {
  const ExcelJS = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  
  // Sheet 1: KPIs
  const kpiSheet = workbook.addWorksheet('Resumen')
  kpiSheet.columns = [
    { header: 'Concepto', key: 'concept', width: 25 },
    { header: 'Valor (€)', key: 'value', width: 15 },
  ]
  
  // Style header
  kpiSheet.getRow(1).font = { bold: true }
  kpiSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE8F5E9' }
  }
  
  kpiSheet.addRow({ concept: 'Ingresos', value: summaryData.income })
  kpiSheet.addRow({ concept: 'Gastos', value: summaryData.expenses })
  kpiSheet.addRow({ concept: 'Balance Neto', value: summaryData.net })
  kpiSheet.addRow({ concept: 'Variación Ahorro', value: summaryData.savingsChange })
  
  // Periodo info
  kpiSheet.addRow({})
  const periodLabel = options.mode === 'monthly' 
    ? `Periodo: ${options.month}/${options.year}`
    : `Periodo: Año ${options.year}`
  kpiSheet.addRow({ concept: periodLabel, value: '' })
  
  // Sheet 2: Categories
  const catSheet = workbook.addWorksheet('Por Categoría')
  catSheet.columns = [
    { header: 'Categoría', key: 'name', width: 30 },
    { header: 'Total (€)', key: 'total', width: 15 },
    { header: 'Porcentaje', key: 'percentage', width: 12 },
  ]
  
  catSheet.getRow(1).font = { bold: true }
  catSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE3F2FD' }
  }
  
  const totalExpenses = categoriesData.reduce((sum, c) => sum + c.total, 0)
  categoriesData.forEach(cat => {
    catSheet.addRow({
      name: cat.categoryName,
      total: cat.total,
      percentage: totalExpenses > 0 ? `${((cat.total / totalExpenses) * 100).toFixed(1)}%` : '0%'
    })
  })
  
  // Sheet 3: Movements for period
  const movSheet = workbook.addWorksheet('Movimientos')
  movSheet.columns = [
    { header: 'Fecha', key: 'date', width: 12 },
    { header: 'Tipo', key: 'type', width: 10 },
    { header: 'Importe (€)', key: 'amount', width: 12 },
    { header: 'Categoría', key: 'category', width: 20 },
    { header: 'Descripción', key: 'description', width: 35 },
    { header: 'Estado', key: 'status', width: 12 },
  ]
  
  movSheet.getRow(1).font = { bold: true }
  movSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFF3E0' }
  }
  
  // Fetch movements for period
  let startDate: string
  let endDate: string
  
  if (options.mode === 'monthly') {
    startDate = `${options.year}-${String(options.month).padStart(2, '0')}-01`
    const lastDay = new Date(options.year, options.month!, 0).getDate()
    endDate = `${options.year}-${String(options.month).padStart(2, '0')}-${lastDay}`
  } else {
    startDate = `${options.year}-01-01`
    endDate = `${options.year}-12-31`
  }
  
  const { data: movements } = await supabase
    .from('movements')
    .select('date, type, amount, category, description, status')
    .eq('user_id', userId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: false })
  
  ;(movements || []).forEach(m => {
    movSheet.addRow({
      date: m.date,
      type: m.type === 'income' ? 'Ingreso' : m.type === 'expense' ? 'Gasto' : 'Inversión',
      amount: m.amount,
      category: m.category || '-',
      description: m.description || '-',
      status: m.status === 'confirmed' ? 'Confirmado' : 'Pendiente'
    })
  })
  
  // Generate filename
  const filename = options.mode === 'monthly'
    ? `resumen_${options.year}_${String(options.month).padStart(2, '0')}.xlsx`
    : `resumen_${options.year}.xlsx`
  
  const buffer = await workbook.xlsx.writeBuffer()
  downloadFile(buffer, filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  
  return movements?.length || 0
}

