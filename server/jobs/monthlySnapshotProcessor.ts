/**
 * Monthly Snapshot Processor
 *
 * Creates or updates a monthly_snapshots row for the previous calendar month.
 * Should be run once per day (e.g., on server startup and then at midnight),
 * but is idempotent — running it multiple times for the same month is safe
 * because it upserts the row.
 *
 * Snapshot fields:
 *   total_income           — sum of income movements in the month
 *   total_expense          — sum of expense movements in the month
 *   balance                — total_income - total_expense
 *   total_cash             — sum of all non-deleted account balances for the user
 *   total_investments_value — sum of (quantity × current_price) for open investments
 */
import { db } from '../db/connection.js'
import { monthlySnapshots, movements, accounts, investments } from '../db/schema.js'
import { and, eq, gte, lte, isNull, sql } from 'drizzle-orm'
import { logger } from '../lib/logger.js'

function toIso(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Compute and upsert a snapshot for every user that had movement activity
 * in the given calendar month (year, month: 1-based).
 */
export async function createMonthlySnapshot(year: number, month: number): Promise<void> {
  const start = new Date(Date.UTC(year, month - 1, 1))
  const end   = new Date(Date.UTC(year, month, 0))      // last day of month
  const startStr = toIso(start)
  const endStr   = toIso(end)
  // The "month" column stores the first day of the month as a date
  const monthKey = startStr

  // --- 1. Find all distinct user IDs that had movements in this period ---
  const userRows = await db
    .selectDistinct({ userId: movements.userId })
    .from(movements)
    .where(
      and(
        gte(movements.date, startStr),
        lte(movements.date, endStr),
        isNull(movements.deletedAt),
      )
    )

  if (userRows.length === 0) {
    logger.info('[monthlySnapshot] No movement activity found', { year, month })
    return
  }

  let created = 0
  let updated = 0

  for (const { userId } of userRows) {
    try {
      // --- 2. Aggregate income & expense for the month ---
      const movRows = await db
        .select({ kind: movements.kind, amount: movements.amount })
        .from(movements)
        .where(
          and(
            eq(movements.userId, userId),
            gte(movements.date, startStr),
            lte(movements.date, endStr),
            isNull(movements.deletedAt),
            isNull(movements.organizationId), // personal only
          )
        )

      let totalIncome = 0
      let totalExpense = 0
      for (const row of movRows) {
        const amt = Number(row.amount) || 0
        if (row.kind === 'income')  totalIncome  += amt
        if (row.kind === 'expense') totalExpense += amt
      }
      const balance = totalIncome - totalExpense

      // --- 3. Total cash: sum of all active personal account balances ---
      const acctRows = await db
        .select({ balance: accounts.balance })
        .from(accounts)
        .where(
          and(
            eq(accounts.userId, userId),
            eq(accounts.isActive, true),
            isNull(accounts.organizationId),
            isNull(accounts.deletedAt),
          )
        )
      const totalCash = acctRows.reduce((s, r) => s + (Number(r.balance) || 0), 0)

      // --- 4. Total investments value: quantity × current_price ---
      const invRows = await db
        .select({ quantity: investments.quantity, currentPrice: investments.currentPrice })
        .from(investments)
        .where(
          and(
            eq(investments.userId, userId),
            isNull(investments.organizationId),
            isNull(investments.deletedAt),
          )
        )
      const totalInvestmentsValue = invRows.reduce(
        (s, r) => s + (Number(r.quantity) || 0) * (Number(r.currentPrice) || 0),
        0,
      )

      // --- 5. Upsert the snapshot row ---
      // Check whether a row already exists for this user+month
      const existing = await db
        .select({ id: monthlySnapshots.id })
        .from(monthlySnapshots)
        .where(
          and(
            eq(monthlySnapshots.userId, userId),
            eq(monthlySnapshots.month, monthKey),
          )
        )
        .limit(1)

      if (existing.length > 0) {
        await db
          .update(monthlySnapshots)
          .set({
            totalIncome:          String(totalIncome.toFixed(2)),
            totalExpense:         String(totalExpense.toFixed(2)),
            balance:              String(balance.toFixed(2)),
            totalCash:            String(totalCash.toFixed(2)),
            totalInvestmentsValue: String(totalInvestmentsValue.toFixed(2)),
          })
          .where(eq(monthlySnapshots.id, existing[0].id))
        updated++
      } else {
        await db.insert(monthlySnapshots).values({
          userId,
          month:                monthKey,
          totalIncome:          String(totalIncome.toFixed(2)),
          totalExpense:         String(totalExpense.toFixed(2)),
          balance:              String(balance.toFixed(2)),
          totalCash:            String(totalCash.toFixed(2)),
          totalInvestmentsValue: String(totalInvestmentsValue.toFixed(2)),
        })
        created++
      }
    } catch (err) {
      logger.error('[monthlySnapshot] Failed for user', {
        userId,
        year,
        month,
        error: err instanceof Error ? err.message : String(err),
      })
      // Continue processing other users
    }
  }

  logger.info('[monthlySnapshot] Done', { year, month, created, updated })
}

/**
 * Convenience wrapper: snapshot the previous calendar month.
 * Safe to call daily — each call is idempotent for the same month.
 */
export async function snapshotPreviousMonth(): Promise<void> {
  const now = new Date()
  const prevMonthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
  await createMonthlySnapshot(prevMonthDate.getUTCFullYear(), prevMonthDate.getUTCMonth() + 1)
}
