import postgres from 'postgres';

const sql = postgres('postgresql://finanzas:finanzas_c0a15d197bbf6728e29fcc26@187.124.116.185:5433/finanzas', { ssl: false });

try {
  const accounts = await sql`
    SELECT a.id, a.name, a.type, a.balance, a.currency, a.parent_account_id, a.user_id, u.email
    FROM accounts a
    LEFT JOIN users u ON u.id = a.user_id
    WHERE a.deleted_at IS NULL
    ORDER BY u.email, a.parent_account_id NULLS FIRST, a.name
  `;
  for (const a of accounts) {
    const indent = a.parent_account_id ? '  └─ ' : '';
    console.log(`${indent}[${a.email}] ${a.name} (${a.type}) balance=${a.balance} ${a.currency} id=${a.id}`);
  }
} finally {
  await sql.end();
}
