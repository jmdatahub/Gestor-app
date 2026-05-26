// Manifest de integraciones externas. Cada integración está gateada por una o
// varias env vars; si falta cualquiera, la integración se marca `disabled` en
// /api/health y en el banner de boot.
//
// Patrón copiado de CRM-app/server/lib/integrations.ts (postmortem
// docs/postmortem-2026-05-18-finanzas-502.md). Adaptado a Gestor-app:
//   • db_finanzas    → DATABASE_URL              (sin BD nada funciona)
//   • telegram_bot   → TELEGRAM_BOT_TOKEN +
//                      TELEGRAM_WEBHOOK_SECRET   (sin esto el webhook 401ea)
//   • resend         → RESEND_API_KEY            (no envía emails)
//
// El bot se chequea con un estado runtime adicional (webhook URL vs PUBLIC_URL,
// pending_update_count, last_error_date) en `telegram-webhook-state.ts` —
// este manifest solo verifica presencia de env vars, no estado externo.

import type { Response } from 'express'

export interface IntegrationDef {
  id: string
  label: string
  envVars: string[]
  impact: string
}

export const INTEGRATIONS: IntegrationDef[] = [
  {
    id: 'db_finanzas',
    label: 'Finanzas (Postgres VPS)',
    envVars: ['DATABASE_URL'],
    impact: 'La app no arranca — toda lectura/escritura falla',
  },
  {
    id: 'telegram_bot',
    label: 'Telegram bot',
    envVars: ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_WEBHOOK_SECRET'],
    impact: 'Webhook rechaza updates (401/503); no se envían mensajes ni notificaciones',
  },
  {
    id: 'resend',
    label: 'Resend (email)',
    envVars: ['RESEND_API_KEY'],
    impact: 'Sin envío de emails (reset password, alta de usuario, alertas)',
  },
]

// Una env var solo cuenta como "presente" si tiene contenido no-vacío tras
// trim — un valor `" "` o `""` en Dokploy no debe marcar la integración como
// habilitada (luego fallaría a runtime sin que el banner avisara).
function hasEnv(name: string): boolean {
  const v = process.env[name]
  return typeof v === 'string' && v.trim().length > 0
}

export function isIntegrationEnabled(id: string): boolean {
  const def = INTEGRATIONS.find(i => i.id === id)
  if (!def) return false
  return def.envVars.every(v => hasEnv(v))
}

export interface IntegrationsStatus {
  ok: string[]
  disabled: string[]
}

export function getIntegrationsStatus(): IntegrationsStatus {
  const ok: string[] = []
  const disabled: string[] = []
  for (const i of INTEGRATIONS) {
    if (i.envVars.every(v => hasEnv(v))) ok.push(i.id)
    else disabled.push(i.id)
  }
  return { ok, disabled }
}

export function logIntegrationsBanner(): void {
  const lines: string[] = []
  lines.push('───── Integrations ─────')
  for (const i of INTEGRATIONS) {
    const missing = i.envVars.filter(v => !hasEnv(v))
    const present = missing.length === 0
    const tag = present ? '✅ OK      ' : '❌ DISABLED'
    const envLabel = i.envVars.join(' + ')
    const trailer = present ? '' : `  → ${i.impact}  [falta: ${missing.join(', ')}]`
    lines.push(`  ${tag}  ${i.label.padEnd(32)} (${envLabel})${trailer}`)
  }
  lines.push('────────────────────────')
  console.log('\n' + lines.join('\n') + '\n')
}

export function requireIntegration(id: string, res: Response): boolean {
  if (isIntegrationEnabled(id)) return false
  const def = INTEGRATIONS.find(i => i.id === id)
  res.status(503).json({
    error: 'Integration disabled',
    integration: id,
    message: def
      ? `Faltan env vars (${def.envVars.join(', ')}) — ${def.impact}`
      : `Integración ${id} desactivada`,
  })
  return true
}
