/**
 * Migration runner: investment_movements table
 * Reads server/db/migrations/0001_investment_movements.sql and applies it.
 */
import postgres from 'postgres';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const url = process.env.DATABASE_URL
  || 'postgresql://finanzas:finanzas_c0a15d197bbf6728e29fcc26@187.124.116.185:5433/finanzas';

const sql = postgres(url, { ssl: false });

try {
  const sqlPath = join(__dirname, '..', 'server', 'db', 'migrations', '0001_investment_movements.sql');
  const ddl = readFileSync(sqlPath, 'utf-8');
  console.log(`Applying migration: ${sqlPath}`);
  await sql.unsafe(ddl);
  console.log('✓ investment_movements migration applied');
} catch (err) {
  console.error('✗ Migration failed:', err.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
