import postgres from 'postgres';
const sql = postgres('postgresql://finanzas:finanzas_c0a15d197bbf6728e29fcc26@187.124.116.185:5433/finanzas', { ssl: false });

// Check check constraints to understand direction values
const constraints = await sql`
  SELECT pg_get_constraintdef(c.oid) AS def
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  WHERE t.relname = 'debts' AND c.contype = 'c'
`;
console.log('Constraints:', constraints.map(c => c.def).join('\n'));

// Check existing debts for reference
const existing = await sql`SELECT direction, counterparty_name, total_amount, is_closed FROM debts WHERE deleted_at IS NULL LIMIT 5`;
console.log('Existing debts:', JSON.stringify(existing));

await sql.end();
