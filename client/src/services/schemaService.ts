/**
 * Schema Service - Schema inspection (stubbed — RPC not available via API)
 *
 * getTableColumns and quickSchemaCheck return stubs.
 * EXPECTED_SCHEMA, compareSchema, generateFixSQL remain intact.
 */

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
  movements: ['id', 'user_id', 'organization_id', 'account_id', 'kind', 'amount', 'date', 'description', 'category_id', 'created_at'],
  accounts: ['id', 'user_id', 'organization_id', 'name', 'type', 'balance', 'is_active', 'parent_account_id', 'created_at'],
  categories: ['id', 'user_id', 'organization_id', 'name', 'kind', 'color', 'created_at'],
  debts: ['id', 'user_id', 'organization_id', 'direction', 'counterparty_name', 'total_amount', 'remaining_amount', 'due_date', 'is_closed', 'created_at'],
  debt_movements: ['id', 'debt_id', 'type', 'amount', 'date', 'note', 'created_at'],
  savings_goals: ['id', 'user_id', 'organization_id', 'name', 'target_amount', 'current_amount', 'target_date', 'status', 'created_at'],
  investments: ['id', 'user_id', 'organization_id', 'name', 'type', 'symbol', 'quantity', 'purchase_price', 'current_price', 'created_at'],
  recurring_rules: ['id', 'user_id', 'organization_id', 'name', 'type', 'amount', 'frequency', 'is_active', 'created_at'],
  alerts: ['id', 'user_id', 'type', 'title', 'message', 'is_read', 'created_at'],
  alert_rules: ['id', 'user_id', 'name', 'type', 'condition', 'is_active', 'created_at']
}

/**
 * Get columns for a specific table
 * Stubbed: schema inspection via RPC is not available through the REST API.
 */
export async function getTableColumns(tableName: string): Promise<TableSchema> {
  return {
    tableName,
    columns: [],
    error: 'Schema inspection not available',
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
 * Stubbed: schema inspection via RPC is not available through the REST API.
 */
export async function quickSchemaCheck(): Promise<string[]> {
  return []
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
