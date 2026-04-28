import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handleError } from './_shared.js'

// Each entity handler lives in api/_handlers/crm-sync/<entity>.ts.
// Files prefixed with `_` are ignored by Vercel's serverless function discovery,
// so importing them here lets us collapse 9 functions into 1 — keeping us under
// the Hobby plan's 12-function ceiling.
import { accountsHandler } from '../_handlers/crm-sync/accounts.js'
import { categoriesHandler } from '../_handlers/crm-sync/categories.js'
import { debtsHandler } from '../_handlers/crm-sync/debts.js'
import { investmentsHandler } from '../_handlers/crm-sync/investments.js'
import { movementsHandler } from '../_handlers/crm-sync/movements.js'
import { overviewHandler } from '../_handlers/crm-sync/overview.js'
import { recurringHandler } from '../_handlers/crm-sync/recurring.js'
import { savingsHandler } from '../_handlers/crm-sync/savings.js'
import { summaryHandler } from '../_handlers/crm-sync/summary.js'

const HANDLERS: Record<string, (req: VercelRequest, res: VercelResponse) => Promise<void> | void> = {
  accounts: accountsHandler,
  categories: categoriesHandler,
  debts: debtsHandler,
  investments: investmentsHandler,
  movements: movementsHandler,
  overview: overviewHandler,
  recurring: recurringHandler,
  savings: savingsHandler,
  summary: summaryHandler,
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const raw = req.query.entity
  const entity = Array.isArray(raw) ? raw[0] : raw
  if (!entity || typeof entity !== 'string') {
    return res.status(400).json({ error: 'Missing entity in path' })
  }

  const handle = HANDLERS[entity]
  if (!handle) {
    return res.status(404).json({ error: `Unknown crm-sync entity: ${entity}` })
  }

  try {
    await handle(req, res)
  } catch (err) {
    return handleError(res, err, `crm-sync/${entity}`)
  }
}
