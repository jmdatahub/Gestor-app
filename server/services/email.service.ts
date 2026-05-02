import { Resend } from 'resend'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM = process.env.EMAIL_FROM || 'Gestor Soul IA <noreply@soulia.info>'
const APP_URL = process.env.PUBLIC_URL || 'http://localhost:5173'

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null

if (!RESEND_API_KEY) {
  console.warn('[email] RESEND_API_KEY no configurada — emails se loguean pero NO se envían')
}

/** Escape HTML special characters to prevent XSS in email templates. */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

/**
 * Send an email with automatic retry (up to 2 retries with exponential back-off).
 * If RESEND_API_KEY is not configured the call is a silent no-op so callers do not
 * need to guard against it — no console.log spam in production.
 */
async function sendEmail(to: string, subject: string, html: string, text: string): Promise<void> {
  if (!resend) {
    // Email is intentionally disabled (no API key). Silent no-op.
    return
  }

  const MAX_ATTEMPTS = 3
  let lastError: unknown
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const { error } = await resend.emails.send({ from: FROM, to: [to], subject, html, text })
    if (!error) return
    lastError = error
    if (attempt < MAX_ATTEMPTS) {
      // Exponential back-off: 500 ms, 1000 ms
      await new Promise(r => setTimeout(r, 500 * attempt))
    }
  }
  console.error(`[email] send failed after ${MAX_ATTEMPTS} attempts:`, lastError)
}

/** HTML layout wrapper for all transactional emails. */
const layout = (title: string, body: string, ctaUrl?: string, ctaLabel?: string): string => `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,sans-serif;background:#111;margin:0;padding:24px;color:#eaeaea">
<div style="max-width:560px;margin:0 auto;background:#1a1a1a;border-radius:12px;padding:32px;border:1px solid #333">
  <h1 style="margin:0 0 16px;color:#f5b66e;font-size:22px">${title}</h1>
  <div style="color:#cfcfcf;line-height:1.6;font-size:14px">${body}</div>
  ${ctaUrl ? `<div style="margin-top:24px"><a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:#f5b66e;color:#111;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600">${escapeHtml(ctaLabel ?? '')}</a></div>` : ''}
  <p style="margin-top:32px;font-size:12px;color:#666">Gestor Soul IA &middot; ${escapeHtml(APP_URL)}</p>
</div>
</body></html>`

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function sendPasswordResetEmail(to: string, name: string, token: string): Promise<void> {
  const safeName = escapeHtml(name || 'Usuario')
  const url = `${APP_URL}/reset-password?token=${encodeURIComponent(token)}`

  const html = layout(
    `Hola ${safeName}`,
    `Has solicitado recuperar tu contraseña. El enlace caduca en <strong>1 hora</strong>.<br><br>
     Si no fuiste tú, ignora este email — tu contraseña no ha cambiado.`,
    url, 'Crear nueva contraseña',
  )

  const text = [
    `Hola ${name || 'Usuario'},`,
    '',
    'Has solicitado recuperar tu contraseña en Gestor Soul IA.',
    'El enlace caduca en 1 hora.',
    '',
    `Enlace: ${url}`,
    '',
    'Si no fuiste tú, ignora este email — tu contraseña no ha cambiado.',
    '',
    `— Gestor Soul IA · ${APP_URL}`,
  ].join('\n')

  await sendEmail(to, 'Recupera tu contraseña — Gestor Soul IA', html, text)
}

export async function sendPasswordChangedEmail(to: string, name: string): Promise<void> {
  const safeName = escapeHtml(name || 'Usuario')

  const html = layout(
    `Hola ${safeName}`,
    `Tu contraseña en Gestor Soul IA acaba de cambiarse correctamente.<br><br>
     Si no fuiste tú, contacta al administrador de inmediato.`,
  )

  const text = [
    `Hola ${name || 'Usuario'},`,
    '',
    'Tu contraseña en Gestor Soul IA acaba de cambiarse correctamente.',
    'Si no fuiste tú, contacta al administrador de inmediato.',
    '',
    `— Gestor Soul IA · ${APP_URL}`,
  ].join('\n')

  await sendEmail(to, 'Tu contraseña ha cambiado — Gestor Soul IA', html, text)
}

export async function sendWelcomeEmail(to: string, name: string): Promise<void> {
  const safeName = escapeHtml(name || 'Usuario')
  const loginUrl = `${APP_URL}/login`

  const html = layout(
    `¡Bienvenido/a, ${safeName}!`,
    `Tu cuenta en <strong>Gestor Soul IA</strong> ha sido activada.<br><br>
     Ya puedes iniciar sesión y empezar a gestionar tus finanzas.`,
    loginUrl, 'Iniciar sesión',
  )

  const text = [
    `¡Bienvenido/a, ${name || 'Usuario'}!`,
    '',
    'Tu cuenta en Gestor Soul IA ha sido activada.',
    'Ya puedes iniciar sesión y empezar a gestionar tus finanzas.',
    '',
    `Accede aquí: ${loginUrl}`,
    '',
    `— Gestor Soul IA · ${APP_URL}`,
  ].join('\n')

  await sendEmail(to, '¡Bienvenido/a a Gestor Soul IA!', html, text)
}

export async function sendNewUserNotificationEmail(adminTo: string, userEmail: string): Promise<void> {
  const safeEmail = escapeHtml(userEmail)
  const url = `${APP_URL}/admin`

  const html = layout(
    'Nuevo registro pendiente',
    `Un nuevo usuario se ha registrado y está esperando tu aprobación:<br><br>
     <strong>Email:</strong> ${safeEmail}<br>
     <strong>Fecha:</strong> ${new Date().toLocaleString('es-ES')}`,
    url, 'Ir al Panel de Admin',
  )

  const text = [
    'Nuevo usuario pendiente de aprobación — Gestor Soul IA',
    '',
    `Email: ${userEmail}`,
    `Fecha: ${new Date().toLocaleString('es-ES')}`,
    '',
    `Panel de administración: ${url}`,
    '',
    `— Gestor Soul IA · ${APP_URL}`,
  ].join('\n')

  await sendEmail(adminTo, 'Nuevo usuario pendiente de aprobación — Gestor Soul IA', html, text)
}
