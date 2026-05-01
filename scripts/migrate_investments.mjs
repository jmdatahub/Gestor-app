/**
 * Migration: add leveraged-position fields to investments
 * Fix BTC & Monero records with correct margin/leverage data
 */
import postgres from 'postgres';

const sql = postgres('postgresql://finanzas:finanzas_c0a15d197bbf6728e29fcc26@187.124.116.185:5433/finanzas', { ssl: false });

try {
  console.log('1. Adding position columns to investments...');
  await sql`
    ALTER TABLE investments
      ADD COLUMN IF NOT EXISTS position_type    text    DEFAULT 'spot',
      ADD COLUMN IF NOT EXISTS leverage         numeric(5,2) DEFAULT 1,
      ADD COLUMN IF NOT EXISTS margin_amount    numeric(15,2),
      ADD COLUMN IF NOT EXISTS is_short         boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS liquidation_price numeric(15,2),
      ADD COLUMN IF NOT EXISTS position_status  text    DEFAULT 'open'
  `;

  // Avoid duplicate constraint errors
  await sql`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'investments_position_type_check'
      ) THEN
        ALTER TABLE investments ADD CONSTRAINT investments_position_type_check
          CHECK (position_type IN ('spot','margin','futures','perpetual'));
      END IF;
    END $$
  `;
  await sql`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'investments_position_status_check'
      ) THEN
        ALTER TABLE investments ADD CONSTRAINT investments_position_status_check
          CHECK (position_status IN ('open','closed','liquidated'));
      END IF;
    END $$
  `;
  console.log('  ✓ Columns added');

  // ── BTC perpetual futures ────────────────────────────────────────────────
  // Screenshot data: 0.02368 BTC, entry $76,333, margin $451.49, liq $39,626
  // Unrealized PnL = (76,266 - 76,333) × 0.02368 = -$1.59
  // Equity = 451.49 - 1.59 = $449.90  → €413.91 (× 0.92)
  console.log('\n2. Fixing BTC position...');
  const [btc] = await sql`
    UPDATE investments SET
      position_type     = 'perpetual',
      leverage          = 4,
      margin_amount     = 451.49,
      is_short          = false,
      liquidation_price = 39626,
      position_status   = 'open',
      purchase_price    = 76333,
      buy_price         = 76333,
      current_price     = 76266,
      symbol            = 'BTC',
      currency          = 'USD'
    WHERE id = 'b08f3d5c-9c1d-4ebc-b905-77c56154cf4f'
    RETURNING id, name
  `;
  console.log(`  ✓ BTC updated: ${btc?.name ?? 'not found'}`);

  // BTC account balance = equity in EUR
  await sql`UPDATE accounts SET balance = 413.91 WHERE id = '83b477d4-8a00-4b0b-af27-ac1068fe7489'`;
  console.log('  ✓ BTC account balance → €413.91 (equity, not position size)');

  // ── Monero perpetual futures ─────────────────────────────────────────────
  // Position ~$300, margin $80 → leverage ≈ 3.75×  | equity = $80 → €73.60
  console.log('\n3. Fixing Monero position...');
  const [xmr] = await sql`
    UPDATE investments SET
      position_type   = 'perpetual',
      leverage        = 3.75,
      margin_amount   = 80,
      is_short        = false,
      position_status = 'open',
      purchase_price  = NULL,
      buy_price       = NULL,
      current_price   = NULL,
      symbol          = 'XMR',
      currency        = 'USD'
    WHERE id = 'fa4a3570-1e5a-43e4-9915-bea3407a205e'
    RETURNING id, name
  `;
  console.log(`  ✓ Monero updated: ${xmr?.name ?? 'not found'}`);

  await sql`UPDATE accounts SET balance = 73.60 WHERE id = 'ba16a3d2-8dbe-477f-a530-7f8eed58b2da'`;
  console.log('  ✓ Monero account balance → €73.60 (equity)');

  // ── Lamine Yamal collectible (already correct as spot) ───────────────────
  await sql`
    UPDATE investments SET position_type = 'spot', position_status = 'open'
    WHERE id = '0d012c36-b467-4571-834f-f21766d762d4'
  `;
  console.log('\n4. ✓ Lamine Yamal collectible → position_type=spot');

  console.log('\n=== Migration complete ===');
} finally {
  await sql.end();
}
