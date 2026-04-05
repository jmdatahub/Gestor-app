import { supabase } from '../lib/supabaseClient'

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

export const fetchAllUserData = async (userId: string) => {
  const backupData: Record<string, any[]> = {}
  
  for (const table of TABLES_TO_BACKUP) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('user_id', userId)
    
    if (error) {
      console.warn(`Error fetching ${table}:`, error.message)
      backupData[table] = []
    } else {
      backupData[table] = data || []
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
