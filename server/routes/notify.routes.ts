import { Router } from 'express'
import type { Response } from 'express'
import { db } from '../db/connection.js'
import { profiles, apiTokens } from '../db/schema.js'
import { eq } from 'drizzle-orm'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'
import { sendTelegramMessage, escapeHtml } from '../services/telegram.service.js'

const router = Router()

const ALLOWED_TYPES = new Set([
  'spending_limit', 'rule_pending', 'savings_goal_progress',
  'investment_drop', 'debt_due', 'general',
])

const ALERT_EMOJI: Record<string, string> = {
  spending_limit: '💸',
  rule_pending: '⏳',
  savings_goal_progress: '🎯',
  investment_drop: '📉',
  debt_due: '⚠️',
  general: '🔔',
}

function buildMessage(type: string, title: string, message: string): string {
  const emoji = ALERT_EMOJI[type] ?? '🔔'
  const now = new Date()
  const dateStr = now.toLocaleDateString('es-ES', {
    day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
  })
  return [
    `🔔 <b>Gestor — Nueva alerta</b>`,
    ``,
    `${emoji} <b>${escapeHtml(title)}</b>`,
    escapeHtml(message),
    ``,
    `<i>🕐 ${dateStr}</i>`,
  ].join('\n')
}

// POST /api/v1/notify
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { type, title, message } = req.body ?? {}

  if (!type || !title || !message) {
    res.status(400).json({ error: 'Faltan campos: type, title, message' }); return
  }
  if (!ALLOWED_TYPES.has(type)) {
    res.status(400).json({ error: `Tipo inválido. Permitidos: ${[...ALLOWED_TYPES].join(', ')}` }); return
  }

  const profile = (await db
    .select({ telegramChatId: profiles.telegramChatId })
    .from(profiles)
    .where(eq(profiles.id, req.userId!))
    .limit(1))[0]

  if (!profile?.telegramChatId) {
    res.json({ sent: false, reason: 'no_telegram_linked' }); return
  }

  const chatId = profile.telegramChatId

  // Check tg_notif:off scope
  const tokens = await db
    .select({ scopes: apiTokens.scopes })
    .from(apiTokens)
    .where(eq(apiTokens.userId, req.userId!))

  const linkedToken = tokens.find(
    t => Array.isArray(t.scopes) && t.scopes.includes(`tg_chat:${chatId}`),
  )
  if (linkedToken?.scopes?.includes('tg_notif:off')) {
    res.json({ sent: false, reason: 'notifications_disabled' }); return
  }

  await sendTelegramMessage(chatId, buildMessage(type, title, message))
  res.json({ sent: true })
})

export default router
