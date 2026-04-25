/**
 * apply-migration.mjs — Applies MIG_026 (alerts upgrade) to Supabase via pg direct
 * Run: node scripts/apply-migration.mjs
 */
import pg from 'pg'
const { Client } = pg

const PROJECT_REF = 'pruiccptamjzemedwhdq'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBydWljY3B0YW1qemVtZWR3aGRxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTU0OTczMiwiZXhwIjoyMDgxMTI1NzMyfQ.etgQek9L-udv6yS9BZ6iPAcC9xek9QXtJxa-Te7YRtA'

// Supabase pooler supports JWT as password
const connectionConfig = {
  host: `aws-0-eu-west-2.pooler.supabase.com`,
  port: 5432,
  database: 'postgres',
  user: `postgres.${PROJECT_REF}`,
  password: SERVICE_ROLE_KEY,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
}

const MIGRATION_SQL = `
-- MIG_026: Alerts upgrade - severity, snooze, action routing

ALTER TABLE alerts
  ADD COLUMN IF NOT EXISTS severity TEXT NOT NULL DEFAULT 'info'
    CHECK (severity IN ('info', 'warning', 'danger'));

ALTER TABLE alerts
  ADD COLUMN IF NOT EXISTS snoozed_until TIMESTAMPTZ NULL;

ALTER TABLE alerts
  ADD COLUMN IF NOT EXISTS action_url TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_alerts_snoozed_until
  ON alerts (user_id, snoozed_until)
  WHERE snoozed_until IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_alerts_severity
  ON alerts (user_id, severity, is_read);

UPDATE alerts SET severity = CASE
  WHEN type = 'debt_due'              THEN 'danger'
  WHEN type = 'spending_limit'        THEN 'warning'
  WHEN type = 'investment_drop'       THEN 'warning'
  WHEN type = 'rule_pending'          THEN 'info'
  WHEN type = 'savings_goal_progress' THEN 'info'
  ELSE 'info'
END;
`

async function main() {
  console.log('🔌 Connecting to Supabase PostgreSQL...')
  const client = new Client(connectionConfig)

  try {
    await client.connect()
    console.log('✅ Connected!')

    // Check existing columns
    const { rows: cols } = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'alerts' AND table_schema = 'public'
      ORDER BY ordinal_position;
    `)
    const existing = cols.map(r => r.column_name)
    console.log('📋 Current columns:', existing.join(', '))

    const needs = ['severity', 'snoozed_until', 'action_url'].filter(c => !existing.includes(c))
    if (needs.length === 0) {
      console.log('✅ Migration already applied — no action needed.')
      return
    }

    console.log('⚙️  Applying migration (missing:', needs.join(', '), ')...')
    await client.query(MIGRATION_SQL)

    // Verify
    const { rows: after } = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'alerts' AND table_schema = 'public'
      ORDER BY ordinal_position;
    `)
    console.log('✅ Migration applied! Columns now:', after.map(r => r.column_name).join(', '))

  } catch (err) {
    console.error('❌ Error:', err.message)
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.message.includes('timeout')) {
      console.log('\n💡 Direct DB connection not available from this environment.')
    } else if (err.message.includes('password') || err.message.includes('auth')) {
      console.log('\n💡 JWT-based DB auth not supported in this pooler configuration.')
    }
    console.log('\n📌 Apply manually at:')
    console.log('   https://supabase.com/dashboard/project/pruiccptamjzemedwhdq/sql/new')
    console.log('   (file: migrations/MIG_026_alerts_upgrade.sql)')
  } finally {
    await client.end().catch(() => {})
  }
}

main()
