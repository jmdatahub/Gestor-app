/**
 * Read-only audit of data integrity in the finanzas DB.
 *
 * Looks for:
 *   - Orphan organizations (no members, no movements/accounts)
 *   - Movements pointing to non-existent or soft-deleted accounts
 *   - Movements pointing to non-existent categories
 *   - Movements/accounts pointing to organizations that don't exist
 *   - Categories/accounts/etc pointing to deleted users
 *   - Soft-deleted rows that still have active children
 */
import postgres from 'postgres';

const sql = postgres('postgresql://finanzas:finanzas_c0a15d197bbf6728e29fcc26@187.124.116.185:5433/finanzas', { ssl: false });

const tag = (s, c = 36) => `\x1b[${c}m${s}\x1b[0m`;
const section = s => console.log('\n' + tag('═'.repeat(60), 35) + '\n' + tag(s, 36) + '\n' + tag('═'.repeat(60), 35));

try {
  // ── 1. Orphan organizations ────────────────────────────────────────────────
  section('1. ORPHAN ORGANIZATIONS (no members at all)');
  const orphans = await sql`
    SELECT o.id, o.name, o.description, o.created_at,
           u.email AS owner_email,
           (SELECT COUNT(*)::int FROM organization_members WHERE org_id = o.id) AS member_count,
           (SELECT COUNT(*)::int FROM movements WHERE organization_id = o.id) AS movement_count,
           (SELECT COUNT(*)::int FROM accounts WHERE organization_id = o.id) AS account_count,
           (SELECT COUNT(*)::int FROM categories WHERE organization_id = o.id) AS category_count,
           (SELECT COUNT(*)::int FROM debts WHERE organization_id = o.id) AS debt_count,
           (SELECT COUNT(*)::int FROM investments WHERE organization_id = o.id) AS investment_count,
           (SELECT COUNT(*)::int FROM savings_goals WHERE organization_id = o.id) AS savings_count,
           (SELECT COUNT(*)::int FROM recurring_rules WHERE organization_id = o.id) AS recurring_count,
           (SELECT COUNT(*)::int FROM payment_methods WHERE organization_id = o.id) AS pm_count,
           (SELECT COUNT(*)::int FROM providers WHERE organization_id = o.id) AS providers_count
    FROM organizations o
    LEFT JOIN users u ON u.id = o.owner_id
    WHERE NOT EXISTS (SELECT 1 FROM organization_members WHERE org_id = o.id)
      AND o.deleted_at IS NULL
  `;
  for (const o of orphans) {
    const total = o.movement_count + o.account_count + o.category_count + o.debt_count +
                  o.investment_count + o.savings_count + o.recurring_count + o.pm_count + o.providers_count;
    console.log(`  • "${o.name}"  id=${o.id}  owner=${o.owner_email ?? '<no owner>'}  data_rows=${total}`);
    if (total > 0) {
      console.log(`      mov=${o.movement_count} acc=${o.account_count} cat=${o.category_count} debt=${o.debt_count} inv=${o.investment_count} sav=${o.savings_count} rec=${o.recurring_count} pm=${o.pm_count} prov=${o.providers_count}`);
    }
  }
  if (orphans.length === 0) console.log('  ✔ none');

  // ── 2. Movements with broken FKs ───────────────────────────────────────────
  section('2. MOVEMENTS WITH MISSING / DELETED FKs');
  const badMovAccount = await sql`
    SELECT COUNT(*)::int AS n FROM movements m
    LEFT JOIN accounts a ON a.id = m.account_id
    WHERE m.deleted_at IS NULL
      AND (a.id IS NULL OR a.deleted_at IS NOT NULL)
  `;
  console.log(`  movements pointing to missing/deleted account: ${badMovAccount[0].n}`);

  const badMovCategory = await sql`
    SELECT COUNT(*)::int AS n FROM movements m
    JOIN categories c ON c.id = m.category_id
    WHERE m.deleted_at IS NULL
      AND m.category_id IS NOT NULL
      AND c.deleted_at IS NOT NULL
  `;
  console.log(`  movements pointing to soft-deleted category:    ${badMovCategory[0].n}`);

  const badMovOrg = await sql`
    SELECT COUNT(*)::int AS n FROM movements m
    LEFT JOIN organizations o ON o.id = m.organization_id
    WHERE m.deleted_at IS NULL
      AND m.organization_id IS NOT NULL
      AND (o.id IS NULL OR o.deleted_at IS NOT NULL)
  `;
  console.log(`  movements pointing to missing/deleted org:      ${badMovOrg[0].n}`);

  const badMovUser = await sql`
    SELECT COUNT(*)::int AS n FROM movements m
    LEFT JOIN users u ON u.id = m.user_id
    WHERE m.deleted_at IS NULL AND u.id IS NULL
  `;
  console.log(`  movements pointing to missing user:             ${badMovUser[0].n}`);

  // ── 3. Accounts ────────────────────────────────────────────────────────────
  section('3. ACCOUNTS WITH MISSING / DELETED FKs');
  const badAccOrg = await sql`
    SELECT COUNT(*)::int AS n FROM accounts a
    LEFT JOIN organizations o ON o.id = a.organization_id
    WHERE a.deleted_at IS NULL
      AND a.organization_id IS NOT NULL
      AND (o.id IS NULL OR o.deleted_at IS NOT NULL)
  `;
  console.log(`  accounts pointing to missing/deleted org:       ${badAccOrg[0].n}`);

  const badAccParent = await sql`
    SELECT COUNT(*)::int AS n FROM accounts a
    LEFT JOIN accounts p ON p.id = a.parent_account_id
    WHERE a.deleted_at IS NULL
      AND a.parent_account_id IS NOT NULL
      AND (p.id IS NULL OR p.deleted_at IS NOT NULL)
  `;
  console.log(`  accounts pointing to missing/deleted parent:    ${badAccParent[0].n}`);

  // ── 4. Members of deleted orgs ─────────────────────────────────────────────
  section('4. ORG_MEMBERS pointing to deleted org / user');
  const badMembers = await sql`
    SELECT COUNT(*)::int AS n FROM organization_members om
    LEFT JOIN organizations o ON o.id = om.org_id
    LEFT JOIN users u ON u.id = om.user_id
    WHERE o.id IS NULL OR u.id IS NULL OR o.deleted_at IS NOT NULL
  `;
  console.log(`  rows: ${badMembers[0].n}`);

  // ── 5. Recurring rules with missing references ─────────────────────────────
  section('5. RECURRING RULES WITH BROKEN FKs');
  const badRec = await sql`
    SELECT COUNT(*)::int AS n FROM recurring_rules r
    LEFT JOIN accounts a ON a.id = r.account_id
    WHERE r.deleted_at IS NULL
      AND (a.id IS NULL OR a.deleted_at IS NOT NULL)
  `;
  console.log(`  recurring rules pointing to missing account: ${badRec[0].n}`);

  // ── 6. Movements with `kind` that doesn't fit current schema ───────────────
  section('6. UNUSUAL VALUES');
  const kinds = await sql`
    SELECT kind, COUNT(*)::int AS n FROM movements
    WHERE deleted_at IS NULL GROUP BY kind ORDER BY n DESC
  `;
  for (const k of kinds) console.log(`  kind=${k.kind}  n=${k.n}`);

  // ── 7. Soft-deleted but still referenced ───────────────────────────────────
  section('7. SOFT-DELETED ACCOUNTS WITH ACTIVE MOVEMENTS');
  const badSoft = await sql`
    SELECT a.id, a.name, COUNT(m.id)::int AS active_movs
    FROM accounts a
    JOIN movements m ON m.account_id = a.id AND m.deleted_at IS NULL
    WHERE a.deleted_at IS NOT NULL
    GROUP BY a.id, a.name
  `;
  for (const r of badSoft) console.log(`  acc="${r.name}" id=${r.id}  active movements=${r.active_movs}`);
  if (badSoft.length === 0) console.log('  ✔ none');

  // ── 8. Duplicate emails / users ────────────────────────────────────────────
  section('8. DUPLICATE USER EMAILS');
  const dups = await sql`
    SELECT email, COUNT(*)::int AS n FROM users GROUP BY email HAVING COUNT(*) > 1
  `;
  if (dups.length === 0) console.log('  ✔ none');
  else for (const d of dups) console.log(`  email=${d.email}  count=${d.n}`);
} finally {
  await sql.end();
}
