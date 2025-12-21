/**
 * Schema Service - Inspecciona el schema real de Supabase
 * 
 * Consulta information_schema para obtener columnas reales
 * y compara con las columnas esperadas por el código.
 */

import { supabase } from '../lib/supabaseClient'

export interface ColumnInfo {
  column_name: string
  data_type: string
  is_nullable: string
}

export interface TableSchema {
  tableName: string
  columns: ColumnInfo[]
  error?: string
}

export interface SchemaMismatch {
  tableName: string
  missing: string[]      // Columns code expects but DB doesn't have
  unexpected: string[]   // Columns DB has that code doesn't expect
  typeErrors: string[]   // Columns with wrong type
}

// Expected columns per table (what the frontend code expects)
export const EXPECTED_SCHEMA: Record<string, string[]> = {
  movements: ['id', 'user_id', 'account_id', 'kind', 'amount', 'date', 'description', 'category_id', 'created_at'],
  accounts: ['id', 'user_id', 'name', 'type', 'balance', 'is_active', 'parent_account_id', 'created_at'],
  categories: ['id', 'user_id', 'name', 'kind', 'color', 'created_at'],
  debts: ['id', 'user_id', 'direction', 'counterparty_name', 'total_amount', 'remaining_amount', 'due_date', 'is_closed', 'created_at'],
  debt_movements: ['id', 'debt_id', 'type', 'amount', 'date', 'note', 'created_at'],
  savings_goals: ['id', 'user_id', 'name', 'target_amount', 'current_amount', 'target_date', 'status', 'created_at'],
  investments: ['id', 'user_id', 'name', 'type', 'symbol', 'quantity', 'purchase_price', 'current_price', 'created_at'],
  recurring_rules: ['id', 'user_id', 'name', 'type', 'amount', 'frequency', 'is_active', 'created_at'],
  alerts: ['id', 'user_id', 'type', 'title', 'message', 'is_read', 'created_at'],
  alert_rules: ['id', 'user_id', 'name', 'type', 'condition', 'is_active', 'created_at']
}

/**
 * Get columns for a specific table
 */
export async function getTableColumns(tableName: string): Promise<TableSchema> {
  try {
    // Query information_schema - this works because it's a read-only system view
    const { data, error } = await supabase
      .rpc('get_table_columns', { table_name: tableName })
    
    if (error) {
      // Fallback: try direct query (may fail if RPC not set up)
      console.warn(`[schemaService] RPC failed, trying direct query for ${tableName}:`, error)
      return {
        tableName,
        columns: [],
        error: `No se pudo obtener schema: ${error.message}`
      }
    }
    
    return {
      tableName,
      columns: data || []
    }
  } catch (err) {
    return {
      tableName,
      columns: [],
      error: err instanceof Error ? err.message : 'Error desconocido'
    }
  }
}

/**
 * Get schema for all main tables
 */
export async function getFullSchema(): Promise<TableSchema[]> {
  const tables = Object.keys(EXPECTED_SCHEMA)
  const results: TableSchema[] = []
  
  for (const table of tables) {
    const schema = await getTableColumns(table)
    results.push(schema)
  }
  
  return results
}

/**
 * Compare actual schema with expected and find mismatches
 */
export function compareSchema(actual: TableSchema[]): SchemaMismatch[] {
  const mismatches: SchemaMismatch[] = []
  
  for (const table of actual) {
    const expected = EXPECTED_SCHEMA[table.tableName]
    if (!expected) continue
    
    const actualColumns = table.columns.map(c => c.column_name)
    
    const missing = expected.filter(col => !actualColumns.includes(col))
    const unexpected = actualColumns.filter(col => !expected.includes(col))
    
    if (missing.length > 0 || unexpected.length > 0) {
      mismatches.push({
        tableName: table.tableName,
        missing,
        unexpected,
        typeErrors: []
      })
    }
  }
  
  return mismatches
}

/**
 * Generate ALTER TABLE SQL to fix missing columns
 * (This is just informational - user must run manually)
 */
export function generateFixSQL(mismatches: SchemaMismatch[]): string {
  const lines: string[] = ['-- SQL para corregir schema\n']
  
  for (const m of mismatches) {
    if (m.missing.length === 0) continue
    
    lines.push(`-- Tabla: ${m.tableName}`)
    for (const col of m.missing) {
      // Generic type - user should adjust
      lines.push(`ALTER TABLE public.${m.tableName} ADD COLUMN IF NOT EXISTS ${col} TEXT;`)
    }
    lines.push('')
  }
  
  return lines.join('\n')
}

/**
 * Quick check for critical columns at startup
 * Returns list of problems found
 */
export async function quickSchemaCheck(): Promise<string[]> {
  const problems: string[] = []
  
  // Check movements table (most critical)
  const movements = await getTableColumns('movements')
  if (movements.error) {
    problems.push(`movements: ${movements.error}`)
  } else {
    const cols = movements.columns.map(c => c.column_name)
    
    // Check critical columns
    if (!cols.includes('kind') && !cols.includes('type')) {
      problems.push('movements: falta columna "kind" o "type"')
    }
    if (!cols.includes('user_id')) {
      problems.push('movements: falta columna "user_id"')
    }
    if (!cols.includes('account_id')) {
      problems.push('movements: falta columna "account_id"')
    }
  }
  
  // Check debts table
  const debts = await getTableColumns('debts')
  if (debts.error) {
    problems.push(`debts: ${debts.error}`)
  } else {
    const cols = debts.columns.map(c => c.column_name)
    
    if (!cols.includes('direction')) {
      problems.push('debts: falta columna "direction"')
    }
    if (!cols.includes('user_id')) {
      problems.push('debts: falta columna "user_id"')
    }
  }
  
  return problems
}

/**
 * Print schema report to console (for debugging)
 */
export async function printSchemaReport(): Promise<void> {
  console.group('📊 DB Schema Report')
  
  const schema = await getFullSchema()
  const mismatches = compareSchema(schema)
  
  for (const table of schema) {
    console.group(`📋 ${table.tableName}`)
    if (table.error) {
      console.error('Error:', table.error)
    } else {
      console.table(table.columns)
    }
    console.groupEnd()
  }
  
  if (mismatches.length > 0) {
    console.group('⚠️ MISMATCHES')
    for (const m of mismatches) {
      console.log(`${m.tableName}:`)
      if (m.missing.length) console.log('  Missing:', m.missing)
      if (m.unexpected.length) console.log('  Unexpected:', m.unexpected)
    }
    console.groupEnd()
  } else {
    console.log('✅ No schema mismatches found')
  }
  
  console.groupEnd()
}
