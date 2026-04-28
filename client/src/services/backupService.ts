import { api } from '../lib/apiClient'

export const TABLES_TO_BACKUP = [
  'accounts',
  'categories',
  'movements',
  'recurring_rules',
  'savings_goals',
  'savings_goal_contributions',
  'savings_contributions',
  'debts',
  'debt_movements',
  'investments',
  'investment_price_history',
  'alerts',
  'alert_rules'
]

// Tables without direct API endpoints — return empty arrays
const UNSUPPORTED_TABLES = new Set([
  'savings_goal_contributions',
  'savings_contributions',
  'debt_movements',
  'investment_price_history',
])

const TABLE_ENDPOINT: Record<string, string> = {
  accounts: '/api/v1/accounts',
  categories: '/api/v1/categories',
  movements: '/api/v1/movements',
  recurring_rules: '/api/v1/recurring-rules',
  savings_goals: '/api/v1/savings-goals',
  debts: '/api/v1/debts',
  investments: '/api/v1/investments',
  alert_rules: '/api/v1/alert-rules',
  alerts: '/api/v1/alerts',
}

export const fetchAllUserData = async (_userId: string) => {
  const backupData: Record<string, any[]> = {}

  for (const table of TABLES_TO_BACKUP) {
    if (UNSUPPORTED_TABLES.has(table)) {
      backupData[table] = []
      continue
    }

    const endpoint = TABLE_ENDPOINT[table]
    if (!endpoint) {
      backupData[table] = []
      continue
    }

    try {
      const params = table === 'movements' ? { limit: 5000 } : undefined
      const { data } = await api.get<{ data: any[] }>(endpoint, params)
      backupData[table] = data || []
    } catch (err: any) {
      console.warn(`Error fetching ${table}:`, err?.message)
      backupData[table] = []
    }
  }

  return backupData
}

export const downloadFullBackup = async (userId: string) => {
  const data = await fetchAllUserData(userId)
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const fileName = `gestor_backup_${timestamp}.json`

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)

  return Object.values(data).reduce((acc, curr) => acc + curr.length, 0)
}
