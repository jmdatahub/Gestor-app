import postgres from 'postgres';

const sql = postgres('postgresql://finanzas:finanzas_c0a15d197bbf6728e29fcc26@187.124.116.185:5433/finanzas', { ssl: false });

try {
  console.log('=== USERS ===');
  const users = await sql`SELECT id, email FROM users ORDER BY email`;
  for (const u of users) console.log(`  ${u.email}  ${u.id}`);

  console.log('\n=== ORGANIZATIONS ===');
  const orgs = await sql`SELECT id, name FROM organizations ORDER BY name`;
  for (const o of orgs) console.log(`  ${o.name}  ${o.id}`);

  console.log('\n=== ORG MEMBERS ===');
  const members = await sql`
    SELECT om.org_id, o.name AS org, om.user_id, u.email, om.role
    FROM organization_members om
    JOIN organizations o ON o.id = om.org_id
    JOIN users u ON u.id = om.user_id
    ORDER BY o.name, u.email
  `;
  for (const m of members) console.log(`  [${m.org}] ${m.email}  role=${m.role}`);

  console.log('\n=== MOVEMENTS PER WORKSPACE (last 30 days, not deleted) ===');
  const counts = await sql`
    SELECT
      COALESCE(o.name, '__personal__') AS workspace,
      u.email AS creator,
      m.kind,
      COUNT(*)::int AS n,
      SUM(m.amount)::numeric(12,2) AS total
    FROM movements m
    LEFT JOIN organizations o ON o.id = m.organization_id
    JOIN users u ON u.id = m.user_id
    WHERE m.deleted_at IS NULL
      AND m.date >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY workspace, creator, m.kind
    ORDER BY workspace, creator, m.kind
  `;
  for (const r of counts) console.log(`  [${r.workspace}] creator=${r.creator}  ${r.kind}  n=${r.n}  total=${r.total}`);

  console.log('\n=== JORGE PERSONAL MOVEMENTS THIS MONTH ===');
  const jorgePersonal = await sql`
    SELECT m.id, m.date, m.kind, m.amount, m.description, m.organization_id
    FROM movements m
    JOIN users u ON u.id = m.user_id
    WHERE u.email = 'jmdatahub@gmail.com'
      AND m.deleted_at IS NULL
      AND m.organization_id IS NULL
      AND date_trunc('month', m.date::date) = date_trunc('month', CURRENT_DATE)
    ORDER BY m.date DESC
  `;
  console.log(`  rows: ${jorgePersonal.length}`);
  for (const m of jorgePersonal) console.log(`    ${m.date}  ${m.kind}  ${m.amount}  "${m.description ?? ''}"`);

  console.log('\n=== SOUL IA MOVEMENTS THIS MONTH (any creator) ===');
  const soulia = await sql`
    SELECT m.id, m.date, m.kind, m.amount, m.description, u.email AS creator
    FROM movements m
    JOIN organizations o ON o.id = m.organization_id
    JOIN users u ON u.id = m.user_id
    WHERE o.name ILIKE 'soul ia'
      AND m.deleted_at IS NULL
      AND date_trunc('month', m.date::date) = date_trunc('month', CURRENT_DATE)
    ORDER BY m.date DESC
  `;
  console.log(`  rows: ${soulia.length}`);
  for (const m of soulia) console.log(`    ${m.date}  ${m.kind}  ${m.amount}  by=${m.creator}  "${m.description ?? ''}"`);
} finally {
  await sql.end();
}
