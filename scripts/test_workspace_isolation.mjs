/**
 * End-to-end workspace isolation test.
 *
 * Steps:
 *   1. Seed two synthetic movements directly in DB:
 *      - "PERS-MOCK"   : creator=mp.jorge00, organization_id=NULL  (personal)
 *      - "SOULIA-MOCK" : creator=nando, organization_id=SOUL IA    (shared org)
 *   2. Hit the live API as mp.jorge00 with three filters:
 *      - GET /api/v1/movements                 → expect ONLY PERS-MOCK
 *      - GET /api/v1/movements?org_id=<SOULIA> → expect ONLY SOULIA-MOCK (created by another user!)
 *      - GET /api/v1/movements?org_id=<JORGE>  → expect [] (mp.jorge00 IS member but no movements there)
 *   3. Negative path: hit with org_id=<Prueba w> (mp.jorge00 NOT a member) → expect 403.
 *   4. Clean up the seeded rows.
 */
import postgres from 'postgres'
import jwt from 'jsonwebtoken'
import { readFileSync } from 'node:fs'

// ── Load .env ────────────────────────────────────────────────────────────────
const envText = readFileSync(new URL('../.env', import.meta.url), 'utf8')
const env = Object.fromEntries(
  envText.split(/\r?\n/).filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)] })
)
const DATABASE_URL = env.DATABASE_URL
const JWT_SECRET = env.JWT_SECRET
const PORT = process.env.TEST_PORT || env.SERVER_PORT || env.PORT || '3001'
const API = `http://localhost:${PORT}`

const sql = postgres(DATABASE_URL, { ssl: false })

// Known IDs from diag_workspace_isolation.mjs
const MP_JORGE = 'ef752990-2714-4c67-83a7-7dcc24acc9ee'   // mp.jorge00@gmail.com (owner of SOUL IA)
const NANDO    = '489d9f78-a8d3-454b-899c-6d766782c834'   // nandoherrera97@gmail.com (member of SOUL IA)
const ORG_SOUL_IA = '3f41457e-f6a4-475f-ae11-a87366904cfd'
const ORG_JORGE   = 'cabec33b-9b0b-4db6-b0de-9c28674b3488' // mp.jorge00 IS a member here too
const ORG_PRUEBA_W = 'f0131f52-0870-4906-a070-83ba2f564cc7' // mp.jorge00 NOT a member here

const tag = (s, c = 36) => `\x1b[${c}m${s}\x1b[0m`
const ok  = s => console.log(tag('  ✔ ', 32) + s)
const bad = s => console.log(tag('  ✘ ', 31) + s)

function makeToken(userId, email) {
  return jwt.sign({ sub: userId, email, role: 'member' }, JWT_SECRET, { expiresIn: '1h' })
}

async function pickAccount(userId, orgId) {
  const rows = await sql`
    SELECT id FROM accounts
    WHERE user_id = ${userId}
      AND ${orgId ? sql`organization_id = ${orgId}` : sql`organization_id IS NULL`}
      AND deleted_at IS NULL
    LIMIT 1
  `
  return rows[0]?.id ?? null
}

async function maybeCreateAccount(userId, orgId, name) {
  let id = await pickAccount(userId, orgId)
  if (id) return { id, created: false }
  const [row] = await sql`
    INSERT INTO accounts (user_id, organization_id, name, type, balance, currency)
    VALUES (${userId}, ${orgId}, ${name}, 'general', 0, 'EUR')
    RETURNING id
  `
  return { id: row.id, created: true }
}

const seeded = { movements: [], accounts: [] }
let pass = 0, fail = 0

async function expect(label, fn) {
  try { await fn(); ok(label); pass++ }
  catch (e) { bad(`${label}: ${e.message}`); fail++ }
}

try {
  console.log(tag('\n[1] SEEDING\n', 35))
  const persAcc = await maybeCreateAccount(MP_JORGE, null, 'TEST-pers-acc')
  const orgAcc  = await maybeCreateAccount(NANDO, ORG_SOUL_IA, 'TEST-soulia-acc')
  if (persAcc.created) seeded.accounts.push(persAcc.id)
  if (orgAcc.created)  seeded.accounts.push(orgAcc.id)
  ok(`personal account: ${persAcc.id}${persAcc.created ? ' (new)' : ''}`)
  ok(`SOUL IA account:  ${orgAcc.id}${orgAcc.created ? ' (new)' : ''}`)

  const today = new Date().toISOString().slice(0, 10)
  const [pers] = await sql`
    INSERT INTO movements (user_id, organization_id, account_id, kind, amount, date, description, status)
    VALUES (${MP_JORGE}, NULL, ${persAcc.id}, 'expense', 11.11, ${today}, 'PERS-MOCK', 'confirmed')
    RETURNING id
  `
  const [souli] = await sql`
    INSERT INTO movements (user_id, organization_id, account_id, kind, amount, date, description, status)
    VALUES (${NANDO}, ${ORG_SOUL_IA}, ${orgAcc.id}, 'expense', 22.22, ${today}, 'SOULIA-MOCK-by-nando', 'confirmed')
    RETURNING id
  `
  seeded.movements.push(pers.id, souli.id)
  ok(`PERS-MOCK   movement id=${pers.id}`)
  ok(`SOULIA-MOCK movement id=${souli.id}`)

  // ── Hit the live API ──────────────────────────────────────────────────────
  console.log(tag('\n[2] HITTING API as mp.jorge00\n', 35))
  const token = makeToken(MP_JORGE, 'mp.jorge00@gmail.com')
  const auth = { Authorization: `Bearer ${token}` }

  const get = async (qs = '') => {
    const r = await fetch(`${API}/api/v1/movements${qs}`, { headers: auth })
    return { status: r.status, body: await r.json().catch(() => ({})) }
  }
  const labels = (rows) => rows.map(m => m.description).sort().join(',')

  await expect('GET /movements (no filter) returns ONLY personal mock', async () => {
    const r = await get(`?startDate=${today}&endDate=${today}`)
    if (r.status !== 200) throw new Error(`status=${r.status}`)
    const seen = labels(r.body.data ?? [])
    if (seen !== 'PERS-MOCK') throw new Error(`expected PERS-MOCK, got "${seen}"`)
  })

  await expect('GET /movements?org_id=SOUL_IA returns SOUL IA mock (created by nando)', async () => {
    const r = await get(`?org_id=${ORG_SOUL_IA}&startDate=${today}&endDate=${today}`)
    if (r.status !== 200) throw new Error(`status=${r.status}`)
    const seen = labels(r.body.data ?? [])
    if (seen !== 'SOULIA-MOCK-by-nando') throw new Error(`expected SOULIA-MOCK-by-nando, got "${seen}"`)
  })

  await expect('GET /movements?org_id=JORGE returns [] (mp.jorge00 IS member, no movements there)', async () => {
    const r = await get(`?org_id=${ORG_JORGE}&startDate=${today}&endDate=${today}`)
    if (r.status !== 200) throw new Error(`status=${r.status}`)
    const seen = labels(r.body.data ?? [])
    if (seen !== '') throw new Error(`expected empty, got "${seen}"`)
  })

  await expect('GET /movements?org_id=Prueba_w returns 403 (NOT a member)', async () => {
    const r = await get(`?org_id=${ORG_PRUEBA_W}`)
    if (r.status !== 403) throw new Error(`expected 403, got ${r.status}`)
  })

  await expect('GET /movements/:id of SOULIA-MOCK is accessible (any org member)', async () => {
    const r = await fetch(`${API}/api/v1/movements/${souli.id}`, { headers: auth })
    if (r.status !== 200) throw new Error(`status=${r.status}`)
  })

  // Write-protection: even though mp.jorge00 is owner of SOUL IA, he must NOT
  // be able to modify a movement created by Nando. Aligns with accounts/etc.
  await expect('PATCH SOULIA-MOCK by non-creator is rejected (404, not 200)', async () => {
    const r = await fetch(`${API}/api/v1/movements/${souli.id}`, {
      method: 'PATCH', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: 'HACK-attempt-by-mp.jorge00' }),
    })
    if (r.status === 200) throw new Error('non-creator was able to PATCH another member\'s movement')
    if (r.status !== 404) throw new Error(`expected 404, got ${r.status}`)
    // Confirm DB is unchanged
    const [check] = await sql`SELECT description FROM movements WHERE id = ${souli.id}`
    if (check.description !== 'SOULIA-MOCK-by-nando') {
      throw new Error(`description was modified to "${check.description}"`)
    }
  })

  await expect('DELETE SOULIA-MOCK by non-creator is rejected (404, not soft-deleted)', async () => {
    const r = await fetch(`${API}/api/v1/movements/${souli.id}`, { method: 'DELETE', headers: auth })
    if (r.status === 200) throw new Error('non-creator was able to DELETE another member\'s movement')
    if (r.status !== 404) throw new Error(`expected 404, got ${r.status}`)
    const [check] = await sql`SELECT deleted_at FROM movements WHERE id = ${souli.id}`
    if (check.deleted_at !== null) throw new Error('movement was soft-deleted by non-creator')
  })

  // Creator path still works: mp.jorge00 patches his OWN PERS-MOCK.
  await expect('PATCH PERS-MOCK by creator works (200)', async () => {
    const r = await fetch(`${API}/api/v1/movements/${pers.id}`, {
      method: 'PATCH', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: 'PERS-MOCK-edited' }),
    })
    if (r.status !== 200) throw new Error(`status=${r.status}`)
    const [check] = await sql`SELECT description FROM movements WHERE id = ${pers.id}`
    if (check.description !== 'PERS-MOCK-edited') throw new Error('PATCH did not persist')
  })

  console.log()
  console.log(tag(`SUMMARY: pass=${pass}  fail=${fail}`, fail === 0 ? 32 : 31))
} catch (e) {
  bad(`fatal: ${e.message}`)
  fail++
} finally {
  // ── Cleanup ────────────────────────────────────────────────────────────────
  console.log(tag('\n[3] CLEANUP\n', 35))
  for (const id of seeded.movements) {
    await sql`DELETE FROM movements WHERE id = ${id}`
    ok(`deleted movement ${id}`)
  }
  for (const id of seeded.accounts) {
    await sql`DELETE FROM accounts WHERE id = ${id}`
    ok(`deleted account ${id}`)
  }
  await sql.end()
  process.exit(fail === 0 ? 0 : 1)
}
