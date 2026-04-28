import { Resend } from 'resend'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM = process.env.EMAIL_FROM || 'Gestor Soul IA <noreply@soulia.info>'
const APP_URL = process.env.PUBLIC_URL || 'http://localhost:5173'

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null

if (!RESEND_API_KEY) {
  console.warn('[email] RESEND_API_KEY no configurada — emails se loguean pero NO se envían')
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!resend) {
    console.log('[email stub]', { to, subject })
    return
  }
  const { error } = await resend.emails.send({ from: FROM, to: [to], subject, html })
  if (error) console.error('[email] send failed:', error)
}

const layout = (title: string, body: string, ctaUrl?: string, ctaLabel?: string) => `
<!DOCTYPE html><html><body style="font-family:-apple-system,sans-serif;background:#111;margin:0;padding:24px;color:#eaeaea">
<div style="max-width:560px;margin:0 auto;background:#1a1a1a;border-radius:12px;padding:32px;border:1px solid #333">
  <h1 style="margin:0 0 16px;color:#f5b66e;font-size:22px">${title}</h1>
  <div style="color:#cfcfcf;line-height:1.6;font-size:14px">${body}</div>
  ${ctaUrl ? `<div style="margin-top:24px"><a href="${ctaUrl}" style="display:inline-block;background:#f5b66e;color:#111;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">${ctaLabel}</a></div>` : ''}
  <p style="margin-top:32px;font-size:12px;color:#666">Gestor Soul IA · ${APP_URL}</p>
</div></body></html>`

export async function sendPasswordResetEmail(to: string, name: string, token: string): Promise<void> {
  const url = `${APP_URL}/reset-password?token=${encodeURIComponent(token)}`
  await sendEmail(to, 'Recupera tu contraseña — Gestor Soul IA', layout(
    `Hola ${name || ''}`,
    `Has solicitado recuperar tu contraseña. El enlace caduca en <strong>1 hora</strong>.<br><br>Si no fuiste tú, ignora este email.`,
    url, 'Crear nueva contraseña',
  ))
}

export async function sendPasswordChangedEmail(to: string, name: string): Promise<void> {
  await sendEmail(to, 'Tu contraseña ha cambiado — Gestor Soul IA', layout(
    `Hola ${name || ''}`,
    `Tu contraseña en Gestor Soul IA acaba de cambiarse. Si no fuiste tú, contacta al administrador.`,
  ))
}
