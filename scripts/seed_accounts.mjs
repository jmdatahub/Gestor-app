/**
 * Seed script: add accounts, investments and savings goals for mp.jorge00@gmail.com
 * Exchange rates used (approx 2026-05-01):
 *   1 USD = 0.92 EUR
 *   1 AUD = 0.59 EUR
 */

import postgres from 'postgres';

const sql = postgres('postgresql://finanzas:finanzas_c0a15d197bbf6728e29fcc26@187.124.116.185:5433/finanzas', {
  ssl: false,
});

const USER_ID    = 'ef752990-2714-4c67-83a7-7dcc24acc9ee'; // mp.jorge00@gmail.com
const AHORRO_ID  = '9c55cd89-ec3c-4bfb-a18c-f066f1d3231e'; // "Ahorro" (savings, root)
const CC_ID      = 'd9fe5379-400e-498a-801b-0a61fef24460'; // "Cuenta corriente" (bank)
const EFECTIVO_ID = 'c4b5d10e-6bb6-4e23-837b-68bfdb9677f8'; // "Efectivo"

async function insertAccount({ name, type, balance, currency = 'EUR', parentId, description = null }) {
  const [row] = await sql`
    INSERT INTO accounts (user_id, name, type, balance, currency, parent_account_id, description, is_active)
    VALUES (${USER_ID}, ${name}, ${type}, ${balance}, ${currency}, ${parentId ?? null}, ${description}, true)
    RETURNING id, name
  `;
  console.log(`  ✓ Cuenta creada: "${row.name}" (id=${row.id})`);
  return row.id;
}

async function insertInvestment({ name, type, symbol, quantity, purchasePrice, currentPrice, currency = 'EUR', accountId, notes }) {
  const [row] = await sql`
    INSERT INTO investments (user_id, name, type, symbol, quantity, purchase_price, current_price, currency, account_id, notes)
    VALUES (${USER_ID}, ${name}, ${type}, ${symbol ?? null}, ${quantity ?? null}, ${purchasePrice ?? null}, ${currentPrice ?? null}, ${currency}, ${accountId ?? null}, ${notes ?? null})
    RETURNING id, name
  `;
  console.log(`  ✓ Inversión creada: "${row.name}" (id=${row.id})`);
  return row.id;
}

async function checkSavingsGoalsTable() {
  const [row] = await sql`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_name = 'savings_goals'
    ) AS exists
  `;
  return row.exists;
}

async function main() {
  console.log('\n=== Seed: Cuentas e inversiones ===\n');

  // ── 1. Sub-cuenta "Inversión" bajo "Ahorro" ────────────────────────────────
  console.log('1. Creando "Inversión" bajo Ahorro...');
  const inversionId = await insertAccount({
    name: 'Inversión',
    type: 'broker',
    balance: 0,
    parentId: AHORRO_ID,
    description: 'Cartera de inversiones y criptomonedas',
  });

  // ── 2. Sub-cuenta "BTC" bajo "Inversión" ──────────────────────────────────
  //    Posición: 0.02368 BTC @ $76,333 entrada → valor $1,806 → €1,661
  //    Margen: $451,49 → €415 | PNL: -$1.59
  console.log('\n2. Creando "BTC" bajo Inversión...');
  const btcAccountId = await insertAccount({
    name: 'BTC',
    type: 'investment',
    balance: 1661.52,  // $1,805.98 × 0.92
    parentId: inversionId,
    description: 'Posición apalancada ×4 | Media entrada $76,333 | Margen $451',
  });

  await insertInvestment({
    name: 'Bitcoin',
    type: 'crypto',
    symbol: 'BTC',
    quantity: 0.02368,
    purchasePrice: 76333,   // entry price USD
    currentPrice: 76266,    // mark price USD
    currency: 'USD',
    accountId: btcAccountId,
    notes: 'Cross margin ×4 | Margen: $451,49 | PNL: -$1,59',
  });

  // ── 3. Sub-cuenta "Monero" bajo "Inversión" ───────────────────────────────
  //    Valor posición: ~$300 → €276 | Margen: $80 → €74
  console.log('\n3. Creando "Monero (XMR)" bajo Inversión...');
  const xmrAccountId = await insertAccount({
    name: 'Monero',
    type: 'investment',
    balance: 276,  // $300 × 0.92
    parentId: inversionId,
    description: 'Posición XMR | Margen $80',
  });

  await insertInvestment({
    name: 'Monero',
    type: 'crypto',
    symbol: 'XMR',
    quantity: null,
    purchasePrice: null,
    currentPrice: null,
    currency: 'USD',
    accountId: xmrAccountId,
    notes: 'Valor posición ~$300 | Margen: $80',
  });

  // ── 4. Sub-cuenta "Coleccionismo" bajo "Inversión" ────────────────────────
  console.log('\n4. Creando "Coleccionismo" bajo Inversión...');
  const coleccionismoId = await insertAccount({
    name: 'Coleccionismo',
    type: 'other',
    balance: 650,
    parentId: inversionId,
    description: 'Cromos, cartas y objetos de colección',
  });

  await insertInvestment({
    name: 'Cromos Lamine Yamal',
    type: 'other',
    symbol: null,
    quantity: 1,
    purchasePrice: 650,
    currentPrice: 650,
    currency: 'EUR',
    accountId: coleccionismoId,
    notes: 'Cromos coleccionables de Lamine Yamal (FC Barcelona)',
  });

  // ── 5. Sub-cuentas bajo "Cuenta corriente" ────────────────────────────────
  console.log('\n5. Creando sub-cuentas de Cuenta corriente...');
  await insertAccount({
    name: 'Santander',
    type: 'bank',
    balance: 120,
    parentId: CC_ID,
  });

  await insertAccount({
    name: 'Revolut',
    type: 'bank',
    balance: 295,  // 500 AUD × 0.59
    parentId: CC_ID,
    description: '500 AUD ≈ €295 (tasa aprox. 0,59)',
  });

  // ── 6. Actualizar saldo de Efectivo ───────────────────────────────────────
  console.log('\n6. Actualizando saldo de Efectivo a €50...');
  await sql`
    UPDATE accounts SET balance = 50, updated_at = NOW()
    WHERE id = ${EFECTIVO_ID}
  `;
  console.log('  ✓ Efectivo actualizado a €50');

  // ── 7. Objetivo de ahorro: Camino de Santiago ─────────────────────────────
  console.log('\n7. Creando objetivo de ahorro "Camino de Santiago"...');
  const hasSavingsGoals = await checkSavingsGoalsTable();
  if (hasSavingsGoals) {
    const [goal] = await sql`
      INSERT INTO savings_goals (user_id, name, target_amount, current_amount, account_id, status)
      VALUES (${USER_ID}, 'Camino de Santiago', 600, 0, ${AHORRO_ID}, 'active')
      RETURNING id, name
    `;
    console.log(`  ✓ Objetivo creado: "${goal.name}" (id=${goal.id})`);
  } else {
    console.log('  ⚠ Tabla savings_goals no encontrada, saltando...');
  }

  console.log('\n=== ¡Listo! Todos los datos insertados correctamente ===\n');
}

main()
  .catch(err => { console.error('ERROR:', err.message); process.exit(1); })
  .finally(() => sql.end());
