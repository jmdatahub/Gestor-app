import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { applySecurityHeaders, isValidUUID } from './_security'

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const telegramToken = process.env.TELEGRAM_BOT_TOKEN || ''
const resendApiKey = process.env.RESEND_API_KEY || ''

// Admin email is read from env — never hardcoded in source
const adminEmail = process.env.ADMIN_EMAIL || ''

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
})

// Only allow notifications for users registered within the last 30 minutes
const REGISTRATION_WINDOW_MS = 30 * 60 * 1000

async function sendTelegramMessage(chatId: string, text: string, reply_markup?: any) {
  const body: any = { chat_id: chatId, text, parse_mode: 'HTML' }
  if (reply_markup) body.reply_markup = reply_markup
  const resp = await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!resp.ok) {
    console.error('Telegram error:', await resp.text())
  }
}

async function sendEmailToAdmin(userEmail: string, userId: string) {
  if (!resendApiKey || !adminEmail) return
  const appUrl = process.env.VITE_SITE_URL || 'https://gestor-app.vercel.app'
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'Gestor App <noreply@resend.dev>',
      to: adminEmail,
      subject: `Nuevo usuario pendiente de aprobación`,
      html: `
        <h2>Nuevo registro pendiente de aprobación</h2>
        <p>Un nuevo usuario se ha registrado y está esperando tu aprobación:</p>
        <ul>
          <li><strong>Email:</strong> ${userEmail}</li>
          <li><strong>Fecha:</strong> ${new Date().toLocaleString('es-ES')}</li>
        </ul>
        <p>
          <a href="${appUrl}/admin" style="background:#4f46e5;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">
            Ir al Panel de Admin
          </a>
        </p>
      `
    })
  })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applySecurityHeaders(res)

  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed')

  const { userId } = req.body

  // Validate UUID format before any DB query
  if (!isValidUUID(userId)) {
    return res.status(400).json({ error: 'Invalid userId' })
  }

  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, email, is_approved, created_at')
      .eq('id', userId)
      .single()

    if (error || !profile) {
      return res.status(404).json({ error: 'User not found' })
    }

    if (profile.is_approved) {
      return res.status(200).json({ message: 'User already approved' })
    }

    // Only send notification if the user registered recently (prevents replay spam)
    const registeredAt = new Date(profile.created_at).getTime()
    if (Date.now() - registeredAt > REGISTRATION_WINDOW_MS) {
      return res.status(429).json({ error: 'Registration notification window expired' })
    }

    const userEmail = profile.email || 'Sin email'

    // Get admin's Telegram chat_id
    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('telegram_chat_id')
      .eq('is_super_admin', true)
      .single()

    // Send Telegram notification to admin
    if (adminProfile?.telegram_chat_id && telegramToken) {
      const keyboard = {
        inline_keyboard: [[
          { text: '✅ Aprobar', callback_data: `app:${userId}` },
          { text: '❌ Rechazar', callback_data: `rej:${userId}` }
        ]]
      }
      await sendTelegramMessage(
        adminProfile.telegram_chat_id,
        `🔔 <b>Nuevo registro pendiente</b>\n\n👤 <b>Email:</b> ${userEmail}\n🕐 <b>Hora:</b> ${new Date().toLocaleString('es-ES')}\n\n¿Apruebas el acceso a esta cuenta?`,
        keyboard
      )
    }

    // Send email notification (optional)
    await sendEmailToAdmin(userEmail, userId).catch(err =>
      console.warn('Email notification failed (non-critical):', err)
    )

    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('notify-new-user error:', err)
    return res.status(500).json({ error: 'Internal error' })
  }
}
