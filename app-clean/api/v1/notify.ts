import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const telegramToken = process.env.TELEGRAM_BOT_TOKEN || ''

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
})

const ALERT_EMOJI: Record<string, string> = {
  spending_limit: '💸',
  rule_pending: '⏳',
  savings_goal_progress: '🎯',
  investment_drop: '📉',
  debt_due: '⚠️',
  general: '🔔'
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function buildMessage(type: string, title: string, message: string): string {
  const emoji = ALERT_EMOJI[type] ?? '🔔'
  const now = new Date()
  const dateStr = now.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit'
  })

  return [
    `🔔 <b>Gestor — Nueva alerta</b>`,
    ``,
    `${emoji} <b>${escapeHtml(title)}</b>`,
    escapeHtml(message),
    ``,
    `<i>🕐 ${dateStr}</i>`
  ].join('\n')
}

async function sendTelegramMessage(chatId: string, text: string): Promise<void> {
  const resp = await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
  })
  if (!resp.ok) {
    const err = await resp.text()
    console.error('[notify] Telegram send error:', err)
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization header' })
  }

  const jwt = authHeader.slice(7)
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(jwt)
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid token' })
  }

  const { type, title, message } = (req.body ?? {}) as Record<string, string>
  if (!type || !title || !message) {
    return res.status(400).json({ error: 'Missing required fields: type, title, message' })
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('telegram_chat_id, telegram_notifications_enabled')
    .eq('id', user.id)
    .single()

  if (!profile?.telegram_chat_id) {
    return res.status(200).json({ sent: false, reason: 'no_telegram_linked' })
  }

  // NULL is treated as enabled (default); only explicit false disables
  if (profile.telegram_notifications_enabled === false) {
    return res.status(200).json({ sent: false, reason: 'notifications_disabled' })
  }

  if (!telegramToken) {
    console.error('[notify] Missing TELEGRAM_BOT_TOKEN')
    return res.status(500).json({ error: 'Telegram not configured' })
  }

  const text = buildMessage(type, title, message)
  await sendTelegramMessage(profile.telegram_chat_id, text)

  return res.status(200).json({ sent: true })
}
