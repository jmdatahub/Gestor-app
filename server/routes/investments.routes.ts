import { Router } from 'express'
import type { Response } from 'express'
import { db } from '../db/connection.js'
import { investments, investmentPriceHistory, investmentMovements } from '../db/schema.js'
import { and, eq, isNull, desc, count } from 'drizzle-orm'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'
import { assertOrgMember } from '../middleware/orgMembership.js'
import { validateUuid } from '../middleware/validateUuid.js'
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

router.get('/:id', validateUuid('id'), authMiddleware, async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string
  const row = (await db.select().from(investments)
    .where(and(eq(investments.id, id), eq(investments.userId, req.userId!))).limit(1))[0]
  if (!row) { res.status(404).json({ error: 'Inversión no encontrada' }); return }
  res.json({ data: mapOut(row) })
})

router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const b = req.body
  // If client provides organization_id, verify the user is a member of that org
  // (otherwise an investment could be silently attributed to an org the user
  // does not belong to).
  const orgIdRaw = b.organization_id ?? b.organizationId ?? null
  if (orgIdRaw) {
    const ok = await assertOrgMember(req, res, String(orgIdRaw))
    if (!ok) return
  }
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

router.patch('/:id', validateUuid('id'), authMiddleware, async (req: AuthRequest, res: Response) => {
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

router.delete('/:id', validateUuid('id'), authMiddleware, async (req: AuthRequest, res: Response) => {
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

// ── Movements (buy/sell) ───────────────────────────────────────────────────

function mapMovementOut(row: Record<string, any>) {
  return {
    id:                  row.id,
    investment_id:       row.investmentId       ?? row.investment_id,
    user_id:             row.userId             ?? row.user_id,
    organization_id:     row.organizationId     ?? row.organization_id     ?? null,
    type:                row.type,
    quantity:            row.quantity != null ? parseFloat(String(row.quantity)) : 0,
    price:               row.price    != null ? parseFloat(String(row.price))    : 0,
    total_amount:        row.totalAmount        != null ? parseFloat(String(row.totalAmount))        : 0,
    margin_delta:        row.marginDelta        != null ? parseFloat(String(row.marginDelta))        : 0,
    spot_quantity_delta: row.spotQuantityDelta  != null ? parseFloat(String(row.spotQuantityDelta))  : 0,
    date:                row.date,
    notes:               row.notes ?? null,
    created_at:          row.createdAt          ?? row.created_at,
    updated_at:          row.updatedAt          ?? row.updated_at,
    deleted_at:          row.deletedAt          ?? row.deleted_at          ?? null,
  }
}

router.get('/:id/movements', validateUuid('id'), authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string
    const inv = (await db.select({ id: investments.id }).from(investments)
      .where(and(eq(investments.id, id), eq(investments.userId, req.userId!), isNull(investments.deletedAt))).limit(1))[0]
    if (!inv) { res.status(404).json({ error: 'Inversión no encontrada' }); return }

    const limit = Math.min(Number(req.query.limit) || 100, 500)
    const offset = Number(req.query.offset) || 0
    const whereClause = and(eq(investmentMovements.investmentId, id), isNull(investmentMovements.deletedAt))
    const [rows, [{ total }]] = await Promise.all([
      db.select().from(investmentMovements)
        .where(whereClause)
        .orderBy(desc(investmentMovements.date))
        .limit(limit).offset(offset),
      db.select({ total: count() }).from(investmentMovements).where(whereClause),
    ])
    res.json({ data: rows.map(mapMovementOut), total: Number(total), limit, offset })
  } catch (err) {
    console.error('[investments/movements GET]', err)
    res.status(500).json({ error: 'Error al obtener movimientos' })
  }
})

router.post('/:id/movements', validateUuid('id'), authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string

    const MovementSchema = z.object({
      type:     z.enum(['buy', 'sell']),
      quantity: z.string().or(z.number()).transform(v => parseFloat(String(v))),
      price:    z.string().or(z.number()).transform(v => parseFloat(String(v))),
      date:     z.string().optional(),
      notes:    z.string().nullable().optional(),
    }).strict()

    let body: z.infer<typeof MovementSchema>
    try {
      body = MovementSchema.parse(req.body)
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: 'Datos inválidos', details: err.issues }); return
      }
      throw err
    }

    if (!Number.isFinite(body.quantity) || body.quantity <= 0) {
      res.status(400).json({ error: 'quantity debe ser un número mayor que 0' }); return
    }
    if (!Number.isFinite(body.price) || body.price < 0) {
      res.status(400).json({ error: 'price debe ser un número mayor o igual que 0' }); return
    }

    // Load the investment & ownership check
    const inv = (await db.select().from(investments)
      .where(and(eq(investments.id, id), eq(investments.userId, req.userId!), isNull(investments.deletedAt))).limit(1))[0]
    if (!inv) { res.status(404).json({ error: 'Inversión no encontrada' }); return }

    const oldQty       = inv.quantity      != null ? parseFloat(String(inv.quantity))      : 0
    const oldPrice     = inv.purchasePrice != null ? parseFloat(String(inv.purchasePrice)) : 0
    const curPrice     = inv.currentPrice  != null ? parseFloat(String(inv.currentPrice))  : 0
    const oldMargin    = inv.marginAmount  != null ? parseFloat(String(inv.marginAmount))  : 0
    const positionType = (inv.positionType ?? 'spot') as string
    const isShort      = !!inv.isShort

    const movQty   = body.quantity
    const movPrice = body.price
    const totalAmount = movQty * movPrice

    let newQty       = oldQty
    let newPurchase  = oldPrice
    let newMargin    = oldMargin
    let marginDelta: number = 0
    let spotQtyDelta: number = 0
    let newPositionStatus = inv.positionStatus ?? 'open'

    if (body.type === 'buy') {
      // Weighted-average purchase price
      const denom = oldQty + movQty
      newQty = denom
      newPurchase = denom > 0 ? ((oldQty * oldPrice) + (movQty * movPrice)) / denom : movPrice
      spotQtyDelta = movQty
      if (positionType !== 'spot') {
        // New margin contributed by the user
        marginDelta = totalAmount
        newMargin = oldMargin + marginDelta
      }
      // Reopen if previously closed
      if (newPositionStatus === 'closed' && (newQty > 0 || newMargin > 0)) {
        newPositionStatus = 'open'
      }
    } else {
      // sell — proportional split (Option A) for leveraged positions
      if (movQty > oldQty + 1e-9) {
        res.status(400).json({ error: 'No se puede vender más cantidad que la posición actual' }); return
      }

      if (positionType === 'spot') {
        newQty = oldQty - movQty
        spotQtyDelta = -movQty
      } else {
        const spotValue = oldQty * curPrice
        const denom = oldMargin + spotValue
        const marginRatio = denom > 0 ? oldMargin / denom : 1
        const soldAmount = totalAmount

        marginDelta = -soldAmount * marginRatio
        const spotAmountReduced = soldAmount * (1 - marginRatio)
        spotQtyDelta = curPrice > 0 ? -spotAmountReduced / curPrice : 0

        newMargin = oldMargin + marginDelta
        newQty = oldQty + spotQtyDelta

        // Numerical safety — clamp tiny negatives to 0
        if (newMargin < 0 && newMargin > -1e-6) newMargin = 0
        if (newQty < 0 && newQty > -1e-9) newQty = 0
      }

      if (newQty <= 0 && newMargin <= 0) {
        newPositionStatus = 'closed'
        newQty = Math.max(newQty, 0)
        newMargin = Math.max(newMargin, 0)
      }
    }

    const actorEmail = req.userEmail ?? null
    const nowIso = new Date().toISOString()
    const dateIso = body.date ?? nowIso

    // Transaction: insert movement + update investment
    const result = await db.transaction(async (tx) => {
      const [updatedInv] = await tx.update(investments).set({
        quantity:       String(newQty),
        purchasePrice:  String(newPurchase),
        marginAmount:   positionType !== 'spot' ? String(newMargin) : inv.marginAmount,
        positionStatus: newPositionStatus,
        updatedAt:      nowIso,
        updatedByEmail: actorEmail,
      } as any).where(eq(investments.id, id)).returning()

      const [movement] = await tx.insert(investmentMovements).values({
        investmentId:       id,
        userId:             req.userId!,
        organizationId:     inv.organizationId ?? null,
        type:               body.type,
        quantity:           String(movQty),
        price:              String(movPrice),
        totalAmount:        String(totalAmount),
        marginDelta:        String(marginDelta),
        spotQuantityDelta:  String(spotQtyDelta),
        date:               dateIso,
        notes:              body.notes ?? null,
      } as any).returning()

      return { updatedInv, movement }
    })

    res.status(201).json({
      data: {
        investment: mapOut(result.updatedInv),
        movement:   mapMovementOut(result.movement),
      }
    })
  } catch (err) {
    console.error('[investments/movements POST]', err)
    res.status(500).json({ error: 'Error al registrar movimiento' })
  }
})

router.delete('/:id/movements/:movementId', validateUuid('id', 'movementId'), authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string
    const movementId = req.params.movementId as string

    const inv = (await db.select().from(investments)
      .where(and(eq(investments.id, id), eq(investments.userId, req.userId!), isNull(investments.deletedAt))).limit(1))[0]
    if (!inv) { res.status(404).json({ error: 'Inversión no encontrada' }); return }

    const movement = (await db.select().from(investmentMovements)
      .where(and(
        eq(investmentMovements.id, movementId),
        eq(investmentMovements.investmentId, id),
        isNull(investmentMovements.deletedAt),
      )).limit(1))[0]
    if (!movement) { res.status(404).json({ error: 'Movimiento no encontrado' }); return }

    const oldQty     = inv.quantity     != null ? parseFloat(String(inv.quantity))     : 0
    const oldPrice   = inv.purchasePrice!= null ? parseFloat(String(inv.purchasePrice)): 0
    const oldMargin  = inv.marginAmount != null ? parseFloat(String(inv.marginAmount)) : 0

    const movQty       = parseFloat(String(movement.quantity))
    const movPrice     = parseFloat(String(movement.price))
    const marginDelta  = movement.marginDelta != null ? parseFloat(String(movement.marginDelta)) : 0
    const spotQtyDelta = movement.spotQuantityDelta != null ? parseFloat(String(movement.spotQuantityDelta)) : 0

    let newQty: number
    let newPurchase = oldPrice
    let newMargin = oldMargin - marginDelta

    if (movement.type === 'buy') {
      // Reverse weighted-average: oldPrice was post-buy avg. Solve for pre-buy.
      newQty = oldQty - movQty
      if (newQty > 1e-9) {
        const totalCost = oldQty * oldPrice
        const movCost = movQty * movPrice
        newPurchase = (totalCost - movCost) / newQty
        if (!Number.isFinite(newPurchase) || newPurchase < 0) newPurchase = oldPrice
      } else {
        newQty = 0
        newPurchase = 0
      }
    } else {
      // sell — reverse the deltas (which were negative)
      newQty = oldQty - spotQtyDelta
    }

    // Numerical safety
    if (newQty < 0 && newQty > -1e-9) newQty = 0
    if (newMargin < 0 && newMargin > -1e-6) newMargin = 0

    const newPositionStatus =
      (newQty > 0 || newMargin > 0) ? 'open' : (inv.positionStatus ?? 'open')

    const positionType = (inv.positionType ?? 'spot') as string
    const actorEmail = req.userEmail ?? null
    const nowIso = new Date().toISOString()

    const result = await db.transaction(async (tx) => {
      const [updatedInv] = await tx.update(investments).set({
        quantity:       String(newQty),
        purchasePrice:  String(newPurchase),
        marginAmount:   positionType !== 'spot' ? String(newMargin) : inv.marginAmount,
        positionStatus: newPositionStatus,
        updatedAt:      nowIso,
        updatedByEmail: actorEmail,
      } as any).where(eq(investments.id, id)).returning()

      const [softDeleted] = await tx.update(investmentMovements)
        .set({ deletedAt: nowIso, updatedAt: nowIso } as any)
        .where(eq(investmentMovements.id, movementId))
        .returning()

      return { updatedInv, softDeleted }
    })

    res.json({
      data: {
        investment: mapOut(result.updatedInv),
        movement:   mapMovementOut(result.softDeleted),
      }
    })
  } catch (err) {
    console.error('[investments/movements DELETE]', err)
    res.status(500).json({ error: 'Error al eliminar movimiento' })
  }
})

// ── Price History ──────────────────────────────────────────────────────────

router.get('/:id/price-history', validateUuid('id'), authMiddleware, async (req: AuthRequest, res: Response) => {
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

router.post('/:id/price-history', validateUuid('id'), authMiddleware, async (req: AuthRequest, res: Response) => {
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
  res.status(201).json({ data: row })
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
