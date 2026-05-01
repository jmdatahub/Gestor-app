import postgres from 'postgres';
const sql = postgres('postgresql://finanzas:finanzas_c0a15d197bbf6728e29fcc26@187.124.116.185:5433/finanzas', { ssl: false });
const USER_ID = 'ef752990-2714-4c67-83a7-7dcc24acc9ee';
const AHORRO_ID = '9c55cd89-ec3c-4bfb-a18c-f066f1d3231e';
const [goal] = await sql`
  INSERT INTO savings_goals (user_id, name, target_amount, current_amount, account_id, status)
  VALUES (${USER_ID}, 'Camino de Santiago', 600, 0, ${AHORRO_ID}, 'active')
  RETURNING id, name
`;
console.log(`✓ Objetivo creado: "${goal.name}" (id=${goal.id})`);
await sql.end();
