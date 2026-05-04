import { Router } from 'express'
import type { Response } from 'express'
import { db } from '../db/connection.js'
import { investments, investmentPriceHistory } from '../db/schema.js'
import { and, eq, isNull, desc, count } from 'drizzle-orm'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'
import { assertOrgMember } from '../middleware/orgMembership.js'
import { z } from 'zod'

const router = Router()

// ── CoinGecko symbol → ID map (server-side, canonical) ────────────────────
const COINGECKO_IDS: Record<string, string> = {
  BTC: 'bitcoin', ETH: 'ethereum', XMR: 'monero', SOL: 'solana',
  ADA: 'cardano', DOT: 'polkadot', AVAX: 'avalanche-2', MATIC: 'matic-network',
  LINK: 'chainlink', UNI: 'uniswap', ATOM: 'cosmos', LTC: 'litecoin',
  BCH: 'bitcoin-cash', XRP: 'ripple', DOGE: 'dogecoin', BNB: 'binancecoin',
  TON: 'the-open-network', NEAR: 'near', APT: 'aptos', ARB: 'arbitrum',
  OP: 'optimism', INJ: 'injective-protocol', SUI: 'sui', SEI: 'sei-network',
}

// Simple in-memory price cache (60s TTL)
const priceCache: Record<string, { eur: number; usd: number; ts: number }> = {}
const CACHE_TTL = 60_000

// ── Field-name bridges ─────────────────────────────────────────────────────
function mapOut(row: Record<string, any>) {
  const posType  = row.positionType    ?? row.position_type    ?? 'spot'
  const leverage = row.leverage != null ? parseFloat(row.leverage) : 1
  const margin   = row.marginAmount  != null ? parseFloat(row.marginAmount)  :
                   row.margin_amount != null ? parseFloat(row.margin_amount) : null
  const liqP     = row.liquidationPrice  != null ? parseFloat(row.liquidationPrice)   :
                   row.liquidation_price != null ? parseFloat(row.liquidation_price)  : null
  const entryP   = row.purchasePrice != null ? parseFloat(row.purchasePrice) :
                   row.purchase_price!= null ? parseFloat(row.purchase_price): null
  const curP     = row.currentPrice  != null ? parseFloat(row.currentPrice)  :
                   row.current_price != null ? parseFloat(row.current_price) : null
  const qty      = row.quantity      != null ? parseFloat(row.quantity)      : null

  // Equity: for leveraged positions = margin + unrealised PnL
  //         for spot                = quantity × current_price
  let equity: number | null = null
  if (posType !== 'spot' && margin != null) {
    if (entryP != null && curP != null && qty != null) {
      const dir = (row.isShort ?? row.is_short) ? -1 : 1
      equity = margin + dir * (curP - entryP) * qty
    } else {
      equity = margin
    }
  } else if (curP != null && qty != null) {
    equity = qty * curP
  }

  return {
    ...row,
    user_id:           row.userId         ?? row.user_id,
    organization_id:   row.organizationId ?? row.organization_id  ?? null,
    type:              row.type,
    asset_type:        row.type,
    symbol:            row.symbol,
    ticker:            row.symbol         ?? row.ticker,
    buy_price:         entryP,
    avg_buy_price:     entryP,
    purchase_price:    entryP,
    current_price:     curP,
    quantity:          qty,
    account_id:        row.accountId      ?? row.account_id       ?? null,
    position_type:     posType,
    leverage,
    margin_amount:     margin,
    is_short:          row.isShort        ?? row.is_short          ?? false,
    liquidation_price: liqP,
    position_status:   row.positionStatus ?? row.position_status   ?? 'open',
    equity,
    created_at:        row.createdAt      ?? row.created_at,
    updated_at:        row.updatedAt      ?? row.updated_at,
    deleted_at:        row.deletedAt      ?? row.deleted_at        ?? null,
  }
}

function mapIn(body: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {}
  if (body.name          != null) out.name          = body.name
  if (body.notes         != null) out.notes         = body.notes
  if (body.currency      != null) out.currency      = body.currency
  if (body.quantity      != null) out.quantity      = body.quantity
  const t = body.type ?? body.asset_type
  if (t                  != null) out.type          = t
  const sym = body.symbol ?? body.ticker
  if (sym                != null) out.symbol        = sym
  const buyP = body.buy_price ?? body.avg_buy_price ?? body.purchase_price
  if (buyP               != null) { out.purchasePrice = buyP; out.buyPrice = buyP }
  if (body.current_price != null) out.currentPrice  = body.current_price
  const acct = body.account_id ?? body.accountId
  if (acct               != null) out.accountId     = acct ?? null
  const org  = body.organization_id ?? body.organizationId
  if (org                != null) out.organizationId = org ?? null
  if (body.position_type     != null) out.positionType     = body.position_type
  if (body.leverage          != null) out.leverage         = body.leverage
  if (body.margin_amount     != null) out.marginAmount     = body.margin_amount
  if (body.is_short          != null) out.isShort          = body.is_short
  if (body.liquidation_price != null) out.liquidationPrice = body.liquidation_price
  if (body.position_status   != null) out.positionStatus   = body.position_status
  return out
}

// ── CRUD ───────────────────────────────────────────────────────────────────

router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const orgId = req.query.org_id as string | undefined
  if (orgId) {
    const ok = await assertOrgMember(req, res, orgId)
    if (!ok) return
  }
  const filter = orgId
    ? eq(investments.organizationId, orgId)
    : and(eq(investments.userId, req.userId!), isNull(investments.organizationId))
  const limit = Math.min(Number(req.query.limit) || 100, 500)
  const offset = Number(req.query.offset) || 0
  const whereClause = and(filter, isNull(investments.deletedAt))
  const [rows, [{ total }]] = await Promise.all([
    db.select().from(investments)
      .where(whereClause)
      .orderBy(desc(investments.createdAt))
      .limit(limit).offset(offset),
    db.select({ total: count() }).from(investments).where(whereClause),
  ])
  res.json({ data: rows.map(mapOut), total: Number(total), limit, offset })
})

router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string
  const row = (await db.select().from(investments)
    .where(and(eq(investments.id, id), eq(investments.userId, req.userId!))).limit(1))[0]
  if (!row) { res.status(404).json({ error: 'Inversión no encontrada' }); return }
  res.json({ data: mapOut(row) })
})

router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const b = req.body
  // Validate quantity: must be a positive number (not 0, not negative)
  const rawQty = b.quantity
  if (rawQty !== undefined && rawQty !== null) {
    const qty = parseFloat(String(rawQty))
    if (isNaN(qty) || qty <= 0) {
      res.status(400).json({ error: 'quantity debe ser un número mayor que 0' }); return
    }
  }
  const actorEmail = req.userEmail ?? null
  const [row] = await db.insert(investments).values({
    name:             b.name,
    type:             b.type ?? b.asset_type ?? 'other',
    symbol:           b.symbol ?? b.ticker ?? null,
    quantity:         b.quantity ?? '0',
    purchasePrice:    b.buy_price ?? b.avg_buy_price ?? b.purchase_price ?? null,
    buyPrice:         b.buy_price ?? b.avg_buy_price ?? b.purchase_price ?? null,
    currentPrice:     b.current_price ?? null,
    currency:         b.currency ?? 'EUR',
    notes:            b.notes ?? null,
    accountId:        b.account_id ?? b.accountId ?? null,
    organizationId:   b.organization_id ?? b.organizationId ?? null,
    positionType:     b.position_type ?? 'spot',
    leverage:         b.leverage ?? '1',
    marginAmount:     b.margin_amount ?? null,
    isShort:          b.is_short ?? false,
    liquidationPrice: b.liquidation_price ?? null,
    positionStatus:   b.position_status ?? 'open',
    userId:           req.userId!,
    createdByEmail:   actorEmail,
    updatedByEmail:   actorEmail,
  } as any).returning()
  res.status(201).json({ data: mapOut(row) })
})

router.patch('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string
  // Include isNull(deletedAt) to prevent updating soft-deleted records
  const existing = (await db.select({ id: investments.id }).from(investments)
    .where(and(eq(investments.id, id), eq(investments.userId, req.userId!), isNull(investments.deletedAt))).limit(1))[0]
  if (!existing) { res.status(404).json({ error: 'Inversión no encontrada' }); return }
  // Validate quantity if being updated
  const rawQty = req.body.quantity
  if (rawQty !== undefined && rawQty !== null) {
    const qty = parseFloat(String(rawQty))
    if (isNaN(qty) || qty <= 0) {
      res.status(400).json({ error: 'quantity debe ser un número mayor que 0' }); return
    }
  }
  const actorEmail = req.userEmail ?? null
  const [updated] = await db.update(investments)
    .set({ ...mapIn(req.body), updatedByEmail: actorEmail } as any)
    .where(eq(investments.id, id))
    .returning()
  res.json({ data: mapOut(updated) })
})

router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string
  const existing = (await db.select({ id: investments.id }).from(investments)
    .where(and(eq(investments.id, id), eq(investments.userId, req.userId!))).limit(1))[0]
  if (!existing) { res.status(404).json({ error: 'Inversión no encontrada' }); return }
  const actorEmail = req.userEmail ?? null
  await Promise.all([
    db.delete(investmentPriceHistory).where(eq(investmentPriceHistory.investmentId, id)),
    db.update(investments).set({ deletedAt: new Date().toISOString(), updatedByEmail: actorEmail } as any).where(eq(investments.id, id)),
  ])
  res.json({ ok: true })
})

// ── Price History ──────────────────────────────────────────────────────────

router.get('/:id/price-history', authMiddleware, async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string
  // Verify the investment belongs to the requesting user
  const inv = (await db.select({ id: investments.id }).from(investments)
    .where(and(eq(investments.id, id), eq(investments.userId, req.userId!))).limit(1))[0]
  if (!inv) { res.status(404).json({ error: 'Inversión no encontrada' }); return }

  const limit = Math.min(Number(req.query.limit) || 200, 1000)
  const offset = Number(req.query.offset) || 0
  const histWhere = eq(investmentPriceHistory.investmentId, id)
  const [rows, [{ total }]] = await Promise.all([
    db.select().from(investmentPriceHistory)
      .where(histWhere)
      .orderBy(desc(investmentPriceHistory.date))
      .limit(limit).offset(offset),
    db.select({ total: count() }).from(investmentPriceHistory).where(histWhere),
  ])
  res.json({ data: rows.map(r => ({
    ...r,
    investment_id: (r as any).investmentId ?? (r as any).investment_id,
    user_id:       (r as any).userId       ?? (r as any).user_id,
    created_at:    (r as any).createdAt    ?? (r as any).created_at,
    price:         r.price != null ? parseFloat(String(r.price)) : null,
  })), total: Number(total), limit, offset })
})

router.post('/:id/price-history', authMiddleware, async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string
  // Verify the investment belongs to the requesting user
  const inv = (await db.select({ id: investments.id }).from(investments)
    .where(and(eq(investments.id, id), eq(investments.userId, req.userId!))).limit(1))[0]
  if (!inv) { res.status(404).json({ error: 'Inversión no encontrada' }); return }

  const PriceSchema = z.object({
    price: z.string().or(z.number()).transform(String),
    date:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }).strict()

  let body: z.infer<typeof PriceSchema>
  try {
    body = PriceSchema.parse(req.body)
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Datos inválidos', details: err.issues }); return
    }
    throw err
  }

  const [row] = await db.insert(investmentPriceHistory)
    .values({ price: body.price, date: body.date, investmentId: id, userId: req.userId! })
    .returning()
  // Sync current_price on the parent investment
  await db.update(investments)
    .set({ currentPrice: body.price, updatedAt: new Date().toISOString() })
    .where(eq(investments.id, id))
  res.status(201).json({ data: {
    ...row,
    investment_id: (row as any).investmentId ?? (row as any).investment_id,
    user_id:       (row as any).userId       ?? (row as any).user_id,
    created_at:    (row as any).createdAt    ?? (row as any).created_at,
    price:         row.price != null ? parseFloat(String(row.price)) : null,
  } })
})

// ── Server-side CoinGecko proxy with 60s cache ─────────────────────────────
// GET /api/v1/investments/prices/crypto?symbols=BTC,XMR
router.get('/prices/crypto', authMiddleware, async (req: AuthRequest, res: Response) => {
  const rawSymbols = (req.query.symbols as string ?? '')
    .toUpperCase().split(',').map(s => s.trim()).filter(Boolean)
  if (!rawSymbols.length) { res.json({ data: {} }); return }

  const now    = Date.now()
  const needed: string[] = []
  const result: Record<string, { eur: number; usd: number }> = {}

  for (const sym of rawSymbols) {
    const cached = priceCache[sym]
    if (cached && now - cached.ts < CACHE_TTL) {
      result[sym] = { eur: cached.eur, usd: cached.usd }
    } else {
      needed.push(sym)
    }
  }

  if (needed.length) {
    const ids = needed.map(s => COINGECKO_IDS[s] ?? s.toLowerCase()).join(',')
    const idToSym: Record<string, string> = {}
    for (const s of needed) idToSym[COINGECKO_IDS[s] ?? s.toLowerCase()] = s

    try {
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=eur,usd`
      const resp = await fetch(url, { signal: AbortSignal.timeout(8000) })
      if (resp.ok) {
        const json = await resp.json() as Record<string, { eur?: number; usd?: number }>
        for (const [cgId, prices] of Object.entries(json)) {
          const sym = idToSym[cgId] ?? cgId.toUpperCase()
          const eur = prices.eur ?? 0
          const usd = prices.usd ?? 0
          priceCache[sym] = { eur, usd, ts: now }
          result[sym]     = { eur, usd }
        }
      }
    } catch (e) {
      console.error('[prices/crypto]', e)
    }
  }

  res.json({ data: result })
})

export default router
