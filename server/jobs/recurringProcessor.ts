import { db, withDbRetry } from '../db/connection.js'
import { recurringRules, movements } from '../db/schema.js'
import { and, eq, isNull, lte } from 'drizzle-orm'

/**
 * Advance a date string (YYYY-MM-DD) by one frequency step.
 * - weekly: +7 days
 * - monthly: +1 month, clamped to last day of that month
 */
function advanceDate(dateStr: string, frequency: string): string {
  const d = new Date(dateStr + 'T00:00:00Z')

  if (frequency === 'weekly') {
    d.setUTCDate(d.getUTCDate() + 7)
  } else {
    // monthly — clamp to last day of the target month
    const originalDay = d.getUTCDate()
    d.setUTCMonth(d.getUTCMonth() + 1, 1) // move to 1st of next month safely
    const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
    d.setUTCDate(Math.min(originalDay, lastDay))
  }

  return d.toISOString().slice(0, 10) // YYYY-MM-DD
}

export async function processRecurringRules(): Promise<void> {
  const todayStr = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

  // Fetch all active, non-deleted rules whose next_occurrence is due
  const dueRules = await withDbRetry(
    () =>
      db
        .select()
        .from(recurringRules)
        .where(
          and(
            eq(recurringRules.isActive, true),
            isNull(recurringRules.deletedAt),
            lte(recurringRules.nextOccurrence, todayStr),
          ),
        ),
    { label: 'recurring:fetchDue' },
  )

  if (dueRules.length === 0) return

  console.log(`[recurringProcessor] Processing ${dueRules.length} due rule(s)`)

  for (const rule of dueRules) {
    try {
      // accountId is required on movements — skip rules without one
      if (!rule.accountId) {
        console.warn(`[recurringProcessor] Skipping rule ${rule.id}: no accountId`)
        // Still advance next_occurrence so it doesn't trigger every run
        const next = advanceDate(rule.nextOccurrence ?? todayStr, rule.frequency)
        await withDbRetry(
          () =>
            db
              .update(recurringRules)
              .set({ nextOccurrence: next })
              .where(eq(recurringRules.id, rule.id)),
          { label: 'recurring:advanceSkipped' },
        )
        continue
      }

      const occurrenceDate = rule.nextOccurrence ?? todayStr

      // Insert a pending movement generated from this rule.
      // Propagate audit ownership from the rule's creator so the movement
      // is traceable back to a human; fall back to a clearly synthetic
      // marker so it never lands as NULL.
      const ruleActorEmail = rule.createdByEmail ?? 'system@recurring'

      await withDbRetry(
        () =>
          db.insert(movements).values({
            userId: rule.userId,
            date: occurrenceDate,
            kind: rule.direction as 'income' | 'expense' | 'transfer',
            amount: rule.amount,
            description: rule.description ?? undefined,
            categoryId: rule.categoryId ?? undefined,
            accountId: rule.accountId,
            status: 'pending',
            recurringRuleId: rule.id,
            organizationId: rule.organizationId ?? undefined,
            createdByEmail: ruleActorEmail,
            updatedByEmail: ruleActorEmail,
          }),
        { label: 'recurring:insertMovement' },
      )

      // Advance next_occurrence by one frequency step
      const nextOccurrence = advanceDate(occurrenceDate, rule.frequency)

      await withDbRetry(
        () =>
          db
            .update(recurringRules)
            .set({ nextOccurrence })
            .where(eq(recurringRules.id, rule.id)),
        { label: 'recurring:advance' },
      )

      console.log(
        `[recurringProcessor] Rule ${rule.id} (${rule.direction} ${rule.amount}): ` +
          `created pending movement for ${occurrenceDate}, next → ${nextOccurrence}`
      )
    } catch (err) {
      // Per-rule isolation: one failure must not stop the rest
      console.error(`[recurringProcessor] Error processing rule ${rule.id}:`, err)
    }
  }
}
