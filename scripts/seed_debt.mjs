import postgres from 'postgres';
const sql = postgres('postgresql://finanzas:finanzas_c0a15d197bbf6728e29fcc26@187.124.116.185:5433/finanzas', { ssl: false });
const USER_ID = 'ef752990-2714-4c67-83a7-7dcc24acc9ee';

// 586 AUD × 0.59 = 345.74 EUR
const [debt] = await sql`
  INSERT INTO debts (user_id, direction, counterparty_name, total_amount, remaining_amount, description, is_closed)
  VALUES (
    ${USER_ID},
    'i_owe',
    'Soul IA',
    345.74,
    345.74,
    '586 AUD convertidos a EUR (tasa aprox. 0,59 | 2026-05-01)',
    false
  )
  RETURNING id, counterparty_name, total_amount
`;
console.log(`✓ Deuda creada: debo €${debt.total_amount} a "${debt.counterparty_name}" (id=${debt.id})`);
await sql.end();
