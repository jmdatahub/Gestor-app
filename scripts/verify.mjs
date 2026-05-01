import postgres from 'postgres';
const sql = postgres('postgresql://finanzas:finanzas_c0a15d197bbf6728e29fcc26@187.124.116.185:5433/finanzas', { ssl: false });
const USER_ID = 'ef752990-2714-4c67-83a7-7dcc24acc9ee';

const accounts = await sql`
  SELECT a.id, a.name, a.type, a.balance, a.currency, a.parent_account_id, a.description
  FROM accounts a
  WHERE a.user_id = ${USER_ID} AND a.deleted_at IS NULL
  ORDER BY a.parent_account_id NULLS FIRST, a.name
`;

// Build tree
const byId = {};
for (const a of accounts) byId[a.id] = { ...a, children: [] };
const roots = [];
for (const a of accounts) {
  if (a.parent_account_id && byId[a.parent_account_id]) {
    byId[a.parent_account_id].children.push(byId[a.id]);
  } else {
    roots.push(byId[a.id]);
  }
}

function print(node, depth = 0) {
  const pad = '  '.repeat(depth) + (depth > 0 ? '└─ ' : '');
  console.log(`${pad}[${node.type}] ${node.name} → €${node.balance}`);
  for (const c of node.children) print(c, depth + 1);
}

console.log('\n=== Estructura de cuentas (mp.jorge00) ===\n');
for (const r of roots) print(r);

const investments = await sql`
  SELECT i.name, i.type, i.symbol, i.quantity, i.purchase_price, i.currency, a.name as account_name
  FROM investments i
  LEFT JOIN accounts a ON a.id = i.account_id
  WHERE i.user_id = ${USER_ID} AND i.deleted_at IS NULL
  ORDER BY i.name
`;
console.log('\n=== Inversiones ===\n');
for (const i of investments) {
  console.log(`  [${i.type}] ${i.name} (${i.symbol ?? '-'}) qty=${i.quantity ?? '-'} precio=${i.purchase_price ?? '-'} ${i.currency} → cuenta: ${i.account_name}`);
}

const goals = await sql`
  SELECT name, target_amount, current_amount, status FROM savings_goals
  WHERE user_id = ${USER_ID} AND deleted_at IS NULL
`;
console.log('\n=== Objetivos de ahorro ===\n');
for (const g of goals) console.log(`  ${g.name}: €${g.current_amount} / €${g.target_amount} [${g.status}]`);

await sql.end();
