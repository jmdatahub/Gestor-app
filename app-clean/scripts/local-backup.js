import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// Configurar paths para ESM
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

// Cargar variables de entorno
dotenv.config({ path: path.join(rootDir, '.env') })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Error: VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no configurados en .env')
  console.log('Asegúrate de añadir SUPABASE_SERVICE_ROLE_KEY desde el panel de Supabase.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false }
})

const TABLES_TO_BACKUP = [
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

async function runBackup() {
  console.log('🚀 Iniciando copia de seguridad local...')
  const backupData = {}
  
  try {
    for (const table of TABLES_TO_BACKUP) {
      console.log(`📦 Descargando tabla: ${table}...`)
      const { data, error } = await supabase
        .from(table)
        .select('*')
      
      if (error) {
        console.warn(`⚠️ Error en ${table}: ${error.message}`)
        backupData[table] = []
      } else {
        backupData[table] = data || []
        console.log(`✅ ${table}: ${data?.length || 0} registros`)
      }
    }

    // Crear carpeta de backups si no existe
    const backupsDir = path.join(rootDir, 'backups')
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir)
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0]
    const fileName = `full_backup_${timestamp}.json`
    const filePath = path.join(backupsDir, fileName)

    fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2))
    
    console.log('\n✨ ¡Copia de seguridad completada con éxito!')
    console.log(`📂 Archivo guardado en: ${filePath}`)
    
  } catch (error) {
    console.error('\n❌ Error crítico durante el backup:', error.message)
    process.exit(1)
  }
}

runBackup()
