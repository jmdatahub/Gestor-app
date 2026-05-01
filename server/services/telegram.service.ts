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

export async function sendTelegramMessage(
  chatId: string | number,
  text: string,
  reply_markup?: InlineKeyboard | ForceReply,
): Promise<void> {
  if (!TELEGRAM_TOKEN) return
  try {
    const body: Record<string, unknown> = { chat_id: chatId, text }
    if (text.includes('<b>') || text.includes('<i>') || text.includes('<code>')) {
      body.parse_mode = 'HTML'
    }
    if (reply_markup) body.reply_markup = reply_markup

    const resp = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!resp.ok) {
      console.error('[telegram] sendMessage error:', await resp.text())
    }
  } catch (err) {
    console.error('[telegram] sendMessage exception:', err)
  }
}

export async function editMessageText(
  chatId: string | number,
  messageId: number,
  text: string,
  reply_markup?: InlineKeyboard,
): Promise<void> {
  if (!TELEGRAM_TOKEN) return
  try {
    const body: Record<string, unknown> = { chat_id: chatId, message_id: messageId, text }
    if (text.includes('<b>') || text.includes('<i>')) body.parse_mode = 'HTML'
    if (reply_markup) body.reply_markup = reply_markup
    const resp = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!resp.ok) console.error('[telegram] editMessageText error:', await resp.text())
  } catch (err) {
    console.error('[telegram] editMessageText exception:', err)
  }
}

export async function answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
  if (!TELEGRAM_TOKEN) return
  try {
    const body: Record<string, unknown> = { callback_query_id: callbackQueryId }
    if (text) body.text = text
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch (err) {
    console.error('[telegram] answerCallbackQuery exception:', err)
  }
}

export async function setMyCommands(): Promise<void> {
  if (!TELEGRAM_TOKEN) return
  try {
    const commands = [
      { command: 'link',          description: 'Vincular tu cuenta de Gestor' },
      { command: 'notifications', description: 'Gestionar alertas (on/off)' },
      { command: 'magia',         description: 'Crear categorias por defecto' },
      { command: 'help',          description: 'Ver ayuda completa' },
      { command: 'start',         description: 'Bienvenida e instrucciones' },
    ]
    const resp = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/setMyCommands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commands }),
    })
    if (!resp.ok) console.error('[telegram] setMyCommands error:', await resp.text())
  } catch (err) {
    console.error('[telegram] setMyCommands exception:', err)
  }
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
