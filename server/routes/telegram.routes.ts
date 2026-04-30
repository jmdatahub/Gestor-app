import { Router } from 'express'
import type { Request, Response } from 'express'
import crypto from 'crypto'
import { db } from '../db/connection.js'
import { profiles, apiTokens, categories, movements, accounts, users } from '../db/schema.js'
import { eq, and, isNull, desc } from 'drizzle-orm'
import {
  sendTelegramMessage,
  editMessageText,
  answerCallbackQuery,
  escapeHtml,
  type ForceReply,
} from '../services/telegram.service.js'

const router = Router()

const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || ''

if (!WEBHOOK_SECRET) {
  console.warn('[telegram-webhook] TELEGRAM_WEBHOOK_SECRET no configurado — webhook rechazará todas las peticiones')
}

async function hashToken(token: string): Promise<string> {
  return crypto.createHash('sha256').update(token).digest('hex')
}

async function buildCategoriesKeyboard(
  userId: string,
  targetOrgId: string | null,
  kind: 'expense' | 'income',
  movPrefix: string,
  page = 0,
) {
  const PAGE_SIZE = 6
  const allCats = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(and(eq(categories.userId, userId), eq(categories.kind, kind)))
    .orderBy(categories.name)

  // Deduplicate by lowercase name
  const seen = new Set<string>()
  const cats = allCats.filter(c => {
    const key = c.name.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  const total = cats.length
  const offset = page * PAGE_SIZE
  const pageCats = cats.slice(offset, offset + PAGE_SIZE)
  const hasNext = offset + PAGE_SIZE < total
  const hasPrev = page > 0
  const kindShort = kind === 'expense' ? 'e' : 'i'
  const keyboard: Array<Array<{ text: string; callback_data: string }>> = []
  let row: Array<{ text: string; callback_data: string }> = []

  pageCats.forEach(cat => {
    row.push({ text: `📌 ${cat.name}`, callback_data: `c:${cat.id.substring(0, 8)}:${movPrefix}` })
    if (row.length === 2) { keyboard.push(row); row = [] }
  })
  if (row.length > 0) keyboard.push(row)

  if (hasPrev || hasNext) {
    const navRow: Array<{ text: string; callback_data: string }> = []
    if (hasPrev) navRow.push({ text: '⬅️', callback_data: `p:${page - 1}:${kindShort}:${movPrefix}` })
    navRow.push({ text: `📄 ${page + 1}/${Math.ceil(total / PAGE_SIZE)}`, callback_data: 'noop' })
    if (hasNext) navRow.push({ text: '➡️', callback_data: `p:${page + 1}:${kindShort}:${movPrefix}` })
    keyboard.push(navRow)
  }

  keyboard.push([{ text: '➕ Nueva categoría', callback_data: `nc:${kindShort}:${movPrefix}` }])

  const switchLabel = kind === 'expense' ? '💰 Ingreso' : '💸 Gasto'
  const switchCb = kind === 'expense' ? `inc:${movPrefix}` : `exp:${movPrefix}`
  keyboard.push([{ text: switchLabel, callback_data: switchCb }])

  return keyboard
}

// POST /api/v1/telegram-webhook
router.post('/', async (req: Request, res: Response) => {
  // Fail-closed: reject if secret not configured
  if (!WEBHOOK_SECRET) {
    res.status(503).json({ error: 'Webhook no configurado' }); return
  }

  // Constant-time validation of Telegram secret token
  const incoming = req.headers['x-telegram-bot-api-secret-token']
  const incomingVal = Array.isArray(incoming) ? incoming[0] : incoming
  if (
    !incomingVal ||
    incomingVal.length !== WEBHOOK_SECRET.length ||
    !crypto.timingSafeEqual(Buffer.from(incomingVal), Buffer.from(WEBHOOK_SECRET))
  ) {
    console.warn('[telegram-webhook] Petición rechazada — secret token inválido')
    res.status(401).json({ error: 'Unauthorized' }); return
  }

  try {
    const body = req.body

    // ── CALLBACK QUERIES (button clicks) ────────────────────────────────────
    if (body.callback_query) {
      const cbId = body.callback_query.id
      const chatId: number = body.callback_query.message.chat.id
      const msgId: number = body.callback_query.message.message_id
      const data: string = body.callback_query.data

      await answerCallbackQuery(cbId)

      // Admin: approve / reject new user
      if (data.startsWith('app:') || data.startsWith('rej:')) {
        const action = data.startsWith('app:') ? 'app' : 'rej'
        const targetUserId = data.slice(4)
        const chatIdStr = chatId.toString()

        const adminProfile = (await db
          .select({ isSuperAdmin: profiles.isSuperAdmin })
          .from(profiles)
          .where(eq(profiles.telegramChatId, chatIdStr))
          .limit(1))[0]

        if (!adminProfile?.isSuperAdmin) {
          await sendTelegramMessage(chatId, '⛔ No tienes permisos para esta acción.')
          res.status(200).send('OK'); return
        }

        const targetUser = (await db
          .select({ email: users.email })
          .from(users)
          .where(eq(users.id, targetUserId))
          .limit(1))[0]
        const targetEmail = targetUser?.email || targetUserId

        if (action === 'app') {
          await db.update(users).set({ isActive: true }).where(eq(users.id, targetUserId))
          await editMessageText(chatId, msgId,
            `✅ <b>Usuario aprobado</b>\n\n👤 ${escapeHtml(targetEmail)}\nYa puede iniciar sesión.`)
        } else {
          await db.delete(users).where(eq(users.id, targetUserId))
          await editMessageText(chatId, msgId,
            `❌ <b>Solicitud rechazada</b>\n\n👤 ${escapeHtml(targetEmail)}\nLa cuenta ha sido eliminada.`)
        }
        res.status(200).send('OK'); return
      }

      // Movement actions — find profile by chatId
      const chatIdStr = chatId.toString()
      const profile = (await db
        .select({ id: profiles.id })
        .from(profiles)
        .where(eq(profiles.telegramChatId, chatIdStr))
        .limit(1))[0]

      if (!profile) { res.status(200).send('OK'); return }
      const userId = profile.id

      const userTokensList = await db
        .select({ organizationId: apiTokens.organizationId, scopes: apiTokens.scopes })
        .from(apiTokens)
        .where(eq(apiTokens.userId, userId))

      const linkedToken = userTokensList.find(
        t => Array.isArray(t.scopes) && t.scopes.some((s: string) => s === `tg_chat:${chatIdStr}`),
      )
      const targetOrgId = linkedToken?.organizationId ?? null

      const parts = data.split(':')

      if (parts[0] === 'c' && parts.length === 3) {
        // Assign category
        const catPrefix = parts[1]
        const movPrefix = parts[2]

        const allUserCats = await db.select({ id: categories.id, name: categories.name })
          .from(categories).where(eq(categories.userId, userId))
        const recentMovs = await db.select({ id: movements.id, amount: movements.amount, kind: movements.kind, description: movements.description })
          .from(movements).where(eq(movements.userId, userId)).orderBy(desc(movements.createdAt)).limit(30)

        const cat = allUserCats.find(c => c.id.startsWith(catPrefix))
        const mov = recentMovs.find(m => m.id.startsWith(movPrefix))

        if (cat && mov) {
          await db.update(movements).set({ categoryId: cat.id }).where(eq(movements.id, mov.id))
          await editMessageText(chatId, msgId,
            `📌 <b>${escapeHtml(cat.name)}</b>\n✅ Categorizado correctamente.\n\n<i>💬 ¿Quieres añadir una nota? Escríbela ahora.</i>`)
        }

      } else if ((parts[0] === 'inc' || parts[0] === 'exp') && parts.length === 2) {
        // Switch kind
        const newKind = parts[0] === 'inc' ? 'income' : 'expense'
        const movPrefix = parts[1]
        const recentMovs = await db.select({ id: movements.id, amount: movements.amount, description: movements.description })
          .from(movements).where(eq(movements.userId, userId)).orderBy(desc(movements.createdAt)).limit(20)
        const mov = recentMovs.find(m => m.id.startsWith(movPrefix))

        if (mov) {
          await db.update(movements).set({ kind: newKind, categoryId: null }).where(eq(movements.id, mov.id))
          const kb = await buildCategoriesKeyboard(userId, targetOrgId, newKind as 'expense' | 'income', movPrefix, 0)
          const safeDesc = escapeHtml(mov.description || '')
          const typeLabel = newKind === 'income' ? 'Ingreso' : 'Gasto'
          const typeSign = newKind === 'income' ? '➕' : '➖'
          const msgTxt = kb.length > 0
            ? `🚀 <b>${typeLabel} convertido:</b>\n${typeSign} <b>${mov.amount}€</b>\n📝 ${safeDesc}\n\n<i>¿En qué categoría lo clasifico?</i>`
            : `🚀 ${typeLabel} convertido:\n${typeSign} ${mov.amount}€\n📝 ${safeDesc}`
          await editMessageText(chatId, msgId, msgTxt, kb.length > 0 ? { inline_keyboard: kb } : undefined)
        }

      } else if (parts[0] === 'p' && parts.length === 4) {
        // Pagination
        const page = parseInt(parts[1], 10)
        const kind = parts[2] === 'e' ? 'expense' : 'income'
        const movPrefix = parts[3]
        const kb = await buildCategoriesKeyboard(userId, targetOrgId, kind as 'expense' | 'income', movPrefix, page)
        const recentMovs = await db.select({ id: movements.id, amount: movements.amount, kind: movements.kind, description: movements.description })
          .from(movements).where(eq(movements.userId, userId)).orderBy(desc(movements.createdAt)).limit(20)
        const mov = recentMovs.find(m => m.id.startsWith(movPrefix))
        if (mov) {
          const safeDesc = escapeHtml(mov.description || '')
          const typeLabel = kind === 'expense' ? 'Gasto' : 'Ingreso'
          const typeSign = kind === 'expense' ? '➖' : '➕'
          const msgTxt = `🚀 <b>${typeLabel} guardado:</b>\n${typeSign} <b>${mov.amount}€</b>\n📝 ${safeDesc}\n\n<i>¿En qué categoría lo clasifico? 👇</i>`
          await editMessageText(chatId, msgId, msgTxt, { inline_keyboard: kb })
        }

      } else if (parts[0] === 'nc' && parts.length === 3) {
        // New category: ask user for name via ForceReply
        const kindShort = parts[1] // 'e' or 'i'
        const movPrefix = parts[2]
        const kindLabel = kindShort === 'e' ? 'gasto' : 'ingreso'
        const fr: ForceReply = { force_reply: true, selective: true, input_field_placeholder: 'Ej: Comida, Ocio, Sueldo…' }
        await sendTelegramMessage(
          chatId,
          `📂 <b>Nueva categoría de ${kindLabel}</b>\n\nEscribe el nombre:\n<code>ref:${kindShort}:${movPrefix}</code>`,
          fr,
        )
      }

      res.status(200).send('OK'); return
    }

    // ── TEXT MESSAGES ────────────────────────────────────────────────────────
    const message = body.message
    if (!message?.text) { res.status(200).send('OK'); return }

    const chatId = message.chat.id
    const text: string = message.text.trim()

    // /link <token>
    if (text.startsWith('/link')) {
      const parts = text.replace(/[<>]/g, '').trim().split(/\s+/)
      if (parts.length < 2) {
        await sendTelegramMessage(chatId, '❌ Debes incluir tu token API. Ejemplo: /link sk_live_ABC123')
        res.status(200).send('OK'); return
      }
      const rawToken = parts[1].trim()
      const tokenHash = await hashToken(rawToken)

      const tokenData = (await db
        .select({ userId: apiTokens.userId, organizationId: apiTokens.organizationId, scopes: apiTokens.scopes })
        .from(apiTokens)
        .where(eq(apiTokens.tokenHash, tokenHash))
        .limit(1))[0]

      if (!tokenData) {
        await sendTelegramMessage(chatId, '❌ Token no encontrado.')
        res.status(200).send('OK'); return
      }

      const chatIdStr = chatId.toString()
      await db.update(profiles).set({ telegramChatId: chatIdStr }).where(eq(profiles.id, tokenData.userId))

      const newScopes = [...((tokenData.scopes as string[]) || [])].filter(s => !s.startsWith('tg_chat:'))
      newScopes.push(`tg_chat:${chatIdStr}`)
      await db.update(apiTokens).set({ scopes: newScopes }).where(eq(apiTokens.tokenHash, tokenHash))

      await sendTelegramMessage(chatId,
        `✅ <b>¡Cuenta vinculada!</b>\n\nA partir de ahora recibirás notificaciones aquí cuando se genere una alerta en Gestor.\n\n<i>Usa /notifications para gestionar tus preferencias.</i>`)
      res.status(200).send('OK'); return
    }

    if (text === '/start') {
      await sendTelegramMessage(chatId,
        `👋 <b>¡Hola! Soy el Gestor Bot.</b>\n\nPuedo ayudarte a:\n• Registrar gastos e ingresos escribiendo el importe\n• Recibir alertas automáticas de tu cuenta\n\n<b>Comandos disponibles:</b>\n/link &lt;token&gt; — Vincular tu cuenta\n/notifications — Gestionar notificaciones\n/help — Ver esta ayuda\n\n<i>Para empezar, usa: /link tu_token</i>`)
      res.status(200).send('OK'); return
    }

    if (text === '/help') {
      await sendTelegramMessage(chatId,
        `📖 <b>Comandos del Gestor Bot</b>\n\n/link &lt;token&gt; — Vincular tu cuenta de Gestor\n/notifications — Activar o desactivar alertas\n/help — Ver esta ayuda\n\n<b>Registro rápido:</b>\nEscribe directamente el importe y la descripción:\n<code>25 mercadona</code> → gasto\n<code>+1000 nómina</code> → ingreso`)
      res.status(200).send('OK'); return
    }

    if (text.startsWith('/notifications')) {
      const chatIdStr = chatId.toString()
      const profile = (await db
        .select({ id: profiles.id })
        .from(profiles)
        .where(eq(profiles.telegramChatId, chatIdStr))
        .limit(1))[0]

      if (!profile) {
        await sendTelegramMessage(chatId, '⚠️ Primero vincula tu cuenta con /link')
        res.status(200).send('OK'); return
      }

      const userTokensList = await db
        .select({ tokenHash: apiTokens.tokenHash, scopes: apiTokens.scopes })
        .from(apiTokens)
        .where(eq(apiTokens.userId, profile.id))

      const linkedToken = userTokensList.find(
        t => Array.isArray(t.scopes) && t.scopes.includes(`tg_chat:${chatIdStr}`),
      )

      if (!linkedToken) {
        await sendTelegramMessage(chatId, '⚠️ No se encontró el token vinculado. Vuelve a usar /link.')
        res.status(200).send('OK'); return
      }

      const arg = text.split(/\s+/)[1]?.toLowerCase()
      const currentScopes: string[] = (linkedToken.scopes as string[]) ?? []
      const isDisabled = currentScopes.includes('tg_notif:off')

      if (arg === 'on') {
        await db.update(apiTokens)
          .set({ scopes: currentScopes.filter(s => s !== 'tg_notif:off') })
          .where(eq(apiTokens.tokenHash, linkedToken.tokenHash))
        await sendTelegramMessage(chatId, '🔔 <b>Notificaciones activadas.</b>\nRecibirás alertas de Gestor aquí.')
      } else if (arg === 'off') {
        await db.update(apiTokens)
          .set({ scopes: [...currentScopes.filter(s => s !== 'tg_notif:off'), 'tg_notif:off'] })
          .where(eq(apiTokens.tokenHash, linkedToken.tokenHash))
        await sendTelegramMessage(chatId, '🔕 <b>Notificaciones desactivadas.</b>\nNo recibirás más alertas aquí.\n\n<i>Puedes reactivarlas con /notifications on</i>')
      } else {
        const status = isDisabled ? '🔕 <b>Desactivadas</b>' : '🔔 <b>Activadas</b>'
        await sendTelegramMessage(chatId, `${status}\n\nUsa:\n/notifications on — activar\n/notifications off — desactivar`)
      }
      res.status(200).send('OK'); return
    }

    // /magia — reset categories to defaults
    if (text === '/magia') {
      const chatIdStr = chatId.toString()
      const profile = (await db
        .select({ id: profiles.id })
        .from(profiles)
        .where(eq(profiles.telegramChatId, chatIdStr))
        .limit(1))[0]

      if (!profile) {
        await sendTelegramMessage(chatId, '⚠️ Vincula tu cuenta primero con /link')
        res.status(200).send('OK'); return
      }
      const userId = profile.id
      const userTokensList = await db
        .select({ organizationId: apiTokens.organizationId, scopes: apiTokens.scopes })
        .from(apiTokens).where(eq(apiTokens.userId, userId))
      const linkedToken = userTokensList.find(
        t => Array.isArray(t.scopes) && t.scopes.some((s: string) => s === `tg_chat:${chatIdStr}`),
      )
      const targetOrgId = linkedToken?.organizationId ?? null

      await db.delete(categories).where(eq(categories.userId, userId))

      const list = [
        // ── GASTOS ──────────────────────────────────────────────────
        { name: 'Gasolina',     kind: 'expense', color: '#f43f5e' },
        { name: 'Ocio',         kind: 'expense', color: '#f97316' },
        { name: 'Comida',       kind: 'expense', color: '#eab308' },
        { name: 'Deporte',      kind: 'expense', color: '#22c55e' },
        { name: 'Transporte',   kind: 'expense', color: '#06b6d4' },
        { name: 'Casa',         kind: 'expense', color: '#14b8a6' },
        { name: 'Salud',        kind: 'expense', color: '#10b981' },
        { name: 'Formación',    kind: 'expense', color: '#3b82f6' },
        { name: 'Herramientas', kind: 'expense', color: '#8b5cf6' },
        { name: 'Ropa',         kind: 'expense', color: '#a78bfa' },
        { name: 'Suscripción',  kind: 'expense', color: '#ec4899' },
        { name: 'Otros',        kind: 'expense', color: '#64748b' },
        // ── INGRESOS ────────────────────────────────────────────────
        { name: 'Soul IA',      kind: 'income',  color: '#8b5cf6' },
        { name: 'Mama',         kind: 'income',  color: '#ec4899' },
        { name: 'Just Jorge',   kind: 'income',  color: '#3b82f6' },
        { name: 'Regalo',       kind: 'income',  color: '#f59e0b' },
        { name: 'Otros',        kind: 'income',  color: '#94a3b8' },
      ]

      await db.insert(categories).values(
        list.map(c => ({ ...c, userId, organizationId: targetOrgId })),
      )

      const orgInfo = targetOrgId ? 'Org: Soul IA' : 'Entorno Personal'
      await sendTelegramMessage(chatId,
        `✨ <b>¡Categorías creadas!</b>\n\nEntorno: <code>${orgInfo}</code>\n\n<b>💸 Gastos:</b> Gasolina, Ocio, Comida, Deporte, Transporte, Casa, Salud, Formación, Herramientas, Ropa, Suscripción, Otros\n\n<b>💰 Ingresos:</b> Soul IA, Mama, Just Jorge, Regalo, Otros`)
      res.status(200).send('OK'); return
    }

    // ── FREE TEXT: register expense/income ───────────────────────────────────
    const chatIdStr = chatId.toString()
    const profile = (await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.telegramChatId, chatIdStr))
      .limit(1))[0]

    if (!profile) {
      await sendTelegramMessage(chatId, '⚠️ Tu chat no está vinculado. Usa /link <TU_TOKEN> primero.')
      res.status(200).send('OK'); return
    }
    const userId = profile.id

    const userTokensList = await db
      .select({ organizationId: apiTokens.organizationId, scopes: apiTokens.scopes })
      .from(apiTokens).where(eq(apiTokens.userId, userId))
    const linkedToken = userTokensList.find(
      t => Array.isArray(t.scopes) && t.scopes.some((s: string) => s === `tg_chat:${chatIdStr}`),
    )
    const targetOrgId = linkedToken?.organizationId ?? null

    // ── REPLY TO CATEGORY CREATION PROMPT ──────────────────────────────────
    // When the user replies to a ForceReply message like "ref:e:abc12345", create the category.
    if (message.reply_to_message) {
      const replyText: string = message.reply_to_message.text || ''
      const catRef = replyText.match(/ref:(e|i):([0-9a-f]{8,})/)
      if (catRef) {
        const kindShort = catRef[1]
        const movPrefix = catRef[2]
        const newKind: 'expense' | 'income' = kindShort === 'e' ? 'expense' : 'income'
        const catName = text.trim().slice(0, 100)

        if (!catName) {
          await sendTelegramMessage(chatId, '❌ El nombre no puede estar vacío.')
          res.status(200).send('OK'); return
        }

        const defaultColor = newKind === 'expense' ? '#ef4444' : '#22c55e'
        const [newCat] = await db.insert(categories).values({
          userId,
          organizationId: targetOrgId,
          name: catName,
          kind: newKind,
          color: defaultColor,
        }).returning({ id: categories.id, name: categories.name })

        if (newCat) {
          const recentMovs = await db.select({ id: movements.id })
            .from(movements).where(eq(movements.userId, userId))
            .orderBy(desc(movements.createdAt)).limit(20)
          const mov = recentMovs.find(m => m.id.startsWith(movPrefix))
          if (mov) {
            await db.update(movements).set({ categoryId: newCat.id }).where(eq(movements.id, mov.id))
            await sendTelegramMessage(chatId, `✅ Categoría <b>${escapeHtml(catName)}</b> creada y asignada.`)
          } else {
            await sendTelegramMessage(chatId, `✅ Categoría <b>${escapeHtml(catName)}</b> creada.`)
          }
        } else {
          await sendTelegramMessage(chatId, '❌ No se pudo crear la categoría.')
        }
        res.status(200).send('OK'); return
      }
    }

    const amountMatch = text.match(/([+-]?)(\d+(?:[.,]\d{1,2})?)(?:€|eur|euros)?(?:\s|$)/i)

    if (!amountMatch) {
      // No amount → treat as note for last movement
      const recentMov = (await db
        .select({ id: movements.id, description: movements.description })
        .from(movements)
        .where(eq(movements.userId, userId))
        .orderBy(desc(movements.createdAt))
        .limit(1))[0]

      if (recentMov) {
        const currentDesc = recentMov.description || ''
        const isPlaceholder = currentDesc === '📱' || currentDesc.includes('Gasto rápido')
        const newDesc = isPlaceholder ? text : `${currentDesc} - ${text}`
        await db.update(movements).set({ description: newDesc }).where(eq(movements.id, recentMov.id))
        await sendTelegramMessage(chatId, '📝 ¡Nota guardada!')
      } else {
        await sendTelegramMessage(chatId,
          '⚠️ No he encontrado un precio claro en tu mensaje.\nEjemplos: "25 mercadona" (gasto) o "+1000 sueldo" (ingreso)')
      }
      res.status(200).send('OK'); return
    }

    const sign = amountMatch[1]
    const amountStr = amountMatch[2].replace(',', '.')
    const amount = Number(amountStr)

    if (amount <= 0 || amount > 10_000_000) {
      await sendTelegramMessage(chatId, '⚠️ El importe no es válido. Debe estar entre 0.01 y 10,000,000.')
      res.status(200).send('OK'); return
    }

    const kind: 'income' | 'expense' = sign === '+' ? 'income' : 'expense'
    let description = text.replace(amountMatch[0], ' ').replace(/^[+-]/, '').trim().slice(0, 500)
    if (!description) description = '📱'

    // Find account for the correct workspace
    const accountsResult = await (targetOrgId === null
      ? db.select({ id: accounts.id }).from(accounts).where(and(eq(accounts.userId, userId), isNull(accounts.organizationId))).limit(1)
      : db.select({ id: accounts.id }).from(accounts).where(and(eq(accounts.userId, userId), eq(accounts.organizationId, targetOrgId))).limit(1))

    if (accountsResult.length === 0) {
      const wName = targetOrgId ? 'ese Entorno de trabajo' : 'tu Entorno Personal'
      await sendTelegramMessage(chatId, `⚠️ Necesitas tener al menos una Cuenta bancaria creada en ${wName}.`)
      res.status(200).send('OK'); return
    }

    const firstCat = (await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.userId, userId), eq(categories.kind, kind)))
      .limit(1))[0]

    const [created] = await db.insert(movements).values({
      userId,
      accountId: accountsResult[0].id,
      organizationId: targetOrgId,
      categoryId: firstCat?.id ?? null,
      kind,
      amount: amount.toString(),
      description,
      date: new Date().toISOString().split('T')[0],
    }).returning({ id: movements.id })

    if (!created) {
      await sendTelegramMessage(chatId, '🔥 No se pudo guardar el movimiento. Inténtalo de nuevo.')
      res.status(200).send('OK'); return
    }

    const movPrefix = created.id.substring(0, 8)
    const kb = await buildCategoriesKeyboard(userId, targetOrgId, kind, movPrefix, 0)
    const safeDesc = escapeHtml(description)
    const typeLabel = kind === 'income' ? 'Ingreso' : 'Gasto'
    const typeSign = kind === 'income' ? '➕' : '➖'
    const msgTxt = kb.length > 0
      ? `🚀 <b>${typeLabel} guardado:</b>\n${typeSign} <b>${amount}€</b>\n📝 ${safeDesc}\n\n<i>¿En qué categoría lo clasifico? 👇</i>\n<i>(También puedes escribir texto para añadir una nota)</i>`
      : `🚀 ${typeLabel} guardado:\n${typeSign} ${amount}€\n📝 ${safeDesc}`

    await sendTelegramMessage(chatId, msgTxt, kb.length > 0 ? { inline_keyboard: kb } : undefined)
    res.status(200).send('OK')

  } catch (err) {
    console.error('[telegram-webhook] Error no controlado:', err)
    res.status(200).send('OK')
  }
})

export default router
