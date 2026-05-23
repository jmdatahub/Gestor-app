const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''

if (!TELEGRAM_TOKEN) {
  console.warn('[telegram] TELEGRAM_BOT_TOKEN no configurado — mensajes de bot no se enviarán')
}

export interface InlineKeyboard {
  inline_keyboard: Array<Array<{ text: string; callback_data: string }>>
}

export interface ForceReply {
  force_reply: true
  selective?: boolean
  input_field_placeholder?: string
}

// ─── Shared fetch helper ─────────────────────────────────────────────────────
// Posts JSON to a Telegram Bot API method with:
//   • AbortController timeout (default 10 s) so a hung Telegram backend never
//     pins our event loop.
//   • Up to MAX_ATTEMPTS retries on transient failures (network error or 5xx
//     / 429 from Telegram) with exponential back-off matching the email
//     service pattern (500 ms × attempt).
//   • Quiet 4xx handling — those are caller-side bugs (bad chat_id, etc.) and
//     retrying won't fix them, so we log once and return.
//
// All errors are swallowed at the boundary (logged, never thrown) because
// Telegram notifications are best-effort — they should NEVER bring down the
// HTTP request or background job that triggered them.
const TELEGRAM_BASE = 'https://api.telegram.org'
const TELEGRAM_TIMEOUT_MS = 10_000
const MAX_ATTEMPTS = 3

async function telegramPost(
  method: string,
  body: Record<string, unknown>,
  context: string,
): Promise<void> {
  if (!TELEGRAM_TOKEN) return

  let lastError: unknown
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), TELEGRAM_TIMEOUT_MS)
    try {
      const resp = await fetch(`${TELEGRAM_BASE}/bot${TELEGRAM_TOKEN}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: ac.signal,
      })
      clearTimeout(timer)

      if (resp.ok) return // success — done

      // 4xx (except 429) are caller-side bugs, retrying won't help.
      if (resp.status >= 400 && resp.status < 500 && resp.status !== 429) {
        const text = await resp.text().catch(() => '')
        console.error(`[telegram] ${context} ${resp.status} — not retrying:`, text)
        return
      }

      // 5xx or 429 — record and retry.
      lastError = new Error(`HTTP ${resp.status}: ${await resp.text().catch(() => '')}`)
    } catch (err) {
      clearTimeout(timer)
      lastError = err
    }

    if (attempt < MAX_ATTEMPTS) {
      // Exponential back-off: 500 ms, 1000 ms.
      await new Promise(r => setTimeout(r, 500 * attempt))
    }
  }
  console.error(`[telegram] ${context} failed after ${MAX_ATTEMPTS} attempts:`, lastError)
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function sendTelegramMessage(
  chatId: string | number,
  text: string,
  reply_markup?: InlineKeyboard | ForceReply,
): Promise<void> {
  const body: Record<string, unknown> = { chat_id: chatId, text }
  if (text.includes('<b>') || text.includes('<i>') || text.includes('<code>')) {
    body.parse_mode = 'HTML'
  }
  if (reply_markup) body.reply_markup = reply_markup
  await telegramPost('sendMessage', body, 'sendMessage')
}

export async function editMessageText(
  chatId: string | number,
  messageId: number,
  text: string,
  reply_markup?: InlineKeyboard,
): Promise<void> {
  const body: Record<string, unknown> = { chat_id: chatId, message_id: messageId, text }
  if (text.includes('<b>') || text.includes('<i>')) body.parse_mode = 'HTML'
  if (reply_markup) body.reply_markup = reply_markup
  await telegramPost('editMessageText', body, 'editMessageText')
}

export async function answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
  const body: Record<string, unknown> = { callback_query_id: callbackQueryId }
  if (text) body.text = text
  await telegramPost('answerCallbackQuery', body, 'answerCallbackQuery')
}

export async function setMyCommands(): Promise<void> {
  const commands = [
    { command: 'link',          description: 'Vincular tu cuenta de Gestor' },
    { command: 'notifications', description: 'Gestionar alertas (on/off)' },
    { command: 'magia',         description: 'Crear categorias por defecto' },
    { command: 'help',          description: 'Ver ayuda completa' },
    { command: 'start',         description: 'Bienvenida e instrucciones' },
  ]
  await telegramPost('setMyCommands', { commands }, 'setMyCommands')
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
