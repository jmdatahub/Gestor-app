// Estado runtime del webhook del bot de Telegram.
//
// El bot puede estar configurado a nivel de env vars (token + secret) y sin
// embargo NO recibir updates si el webhook está desregistrado en Telegram. El
// agujero exacto del incidente del 22-may-2026: alguien hizo `deleteWebhook`
// durante la migración Vercel → VPS y Telegram dejó de entregar updates
// durante días sin que `/api/health` se enterara (solo chequeaba env vars y DB).
//
// Este módulo ofrece:
//   • getWebhookInfoCached() — Llama getWebhookInfo a Telegram, con cache de
//     60 s para no martillear la API en cada /api/health hit. Falla soft.
//   • ensureWebhookRegistered() — Llamada idempotente al boot del server. Si
//     el webhook está vacío o apunta a otra URL distinta del PUBLIC_URL
//     esperado, lo re-registra con setWebhook. Devuelve un estado discreto.

import { logger } from './logger.js'

const TELEGRAM_BASE = 'https://api.telegram.org'

export interface WebhookInfo {
  url: string
  has_custom_certificate: boolean
  pending_update_count: number
  ip_address?: string
  last_error_date?: number     // epoch seconds
  last_error_message?: string
  last_synchronization_error_date?: number
  max_connections?: number
  allowed_updates?: string[]
}

export type BotHealthStatus =
  | 'ok'           // webhook alineado, sin errores recientes, pending OK
  | 'misaligned'   // webhook apunta a otra URL (probablemente Vercel viejo)
  | 'empty'        // webhook desregistrado
  | 'lagging'      // pending_update_count alto (>50)
  | 'errored'      // last_error_date reciente (<10 min)
  | 'unreachable'  // no se pudo llamar a Telegram API
  | 'disabled'     // env vars no configuradas

export interface BotHealth {
  status: BotHealthStatus
  expectedUrl: string | null
  info: WebhookInfo | null
  reason?: string  // si no es 'ok', explica por qué
}

let cache: { at: number; value: BotHealth } | null = null
// Single-flight: si una llamada está en vuelo, los hits concurrentes esperan a
// la misma promesa en lugar de disparar N llamadas paralelas a Telegram (la
// API limita ~30 req/s y nuestro /health puede recibir más en una ráfaga).
let inflight: Promise<BotHealth> | null = null
const CACHE_TTL_MS = 60_000
const PENDING_THRESHOLD = 50
const ERROR_RECENT_S = 600  // 10 min

function expectedWebhookUrl(): string | null {
  const publicUrl = process.env.PUBLIC_URL
  if (!publicUrl) return null
  // Webhook path coincide con el mount en server/index.ts → /api/v1/telegram-webhook
  return `${publicUrl.replace(/\/$/, '')}/api/v1/telegram-webhook`
}

export async function callTelegram<T>(
  method: string,
  body?: Record<string, unknown>,
): Promise<{ ok: true; result: T } | { ok: false; error: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return { ok: false, error: 'TELEGRAM_BOT_TOKEN no configurado' }

  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), 8_000)
  try {
    const res = await fetch(`${TELEGRAM_BASE}/bot${token}/${method}`, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
      signal: ac.signal,
    })
    clearTimeout(timer)
    const json = (await res.json()) as { ok: boolean; result?: T; description?: string }
    if (!json.ok) return { ok: false, error: json.description ?? `HTTP ${res.status}` }
    return { ok: true, result: json.result as T }
  } catch (err) {
    clearTimeout(timer)
    return { ok: false, error: (err as Error).message }
  }
}

async function fetchBotHealth(): Promise<BotHealth> {
  const expectedUrl = expectedWebhookUrl()

  // Sin env vars básicas → 'disabled' (no es error, es deliberado)
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_WEBHOOK_SECRET) {
    return { status: 'disabled', expectedUrl, info: null, reason: 'env vars no configuradas' }
  }

  const res = await callTelegram<WebhookInfo>('getWebhookInfo')
  if (!res.ok) {
    return { status: 'unreachable', expectedUrl, info: null, reason: res.error }
  }
  const info = res.result

  if (!info.url) {
    return { status: 'empty', expectedUrl, info, reason: 'webhook desregistrado en Telegram' }
  }
  if (expectedUrl && info.url !== expectedUrl) {
    return {
      status: 'misaligned',
      expectedUrl,
      info,
      reason: `webhook apunta a ${info.url}, se esperaba ${expectedUrl}`,
    }
  }
  if (info.last_error_date && Date.now() / 1000 - info.last_error_date < ERROR_RECENT_S) {
    return {
      status: 'errored',
      expectedUrl,
      info,
      reason: `last_error_date hace ${Math.round(Date.now() / 1000 - info.last_error_date)}s: ${info.last_error_message ?? '(sin mensaje)'}`,
    }
  }
  if (info.pending_update_count > PENDING_THRESHOLD) {
    return {
      status: 'lagging',
      expectedUrl,
      info,
      reason: `pending_update_count=${info.pending_update_count} (umbral ${PENDING_THRESHOLD})`,
    }
  }
  return { status: 'ok', expectedUrl, info }
}

export async function getBotHealthCached(): Promise<BotHealth> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.value
  if (inflight) return inflight  // coalesce concurrent requests
  inflight = (async () => {
    try {
      const value = await fetchBotHealth()
      cache = { at: Date.now(), value }
      return value
    } finally {
      inflight = null
    }
  })()
  return inflight
}

// Limpiar caché para forzar reevaluación (útil tras setWebhook).
export function invalidateBotHealthCache(): void {
  cache = null
}

/**
 * Llamada idempotente: si el webhook está vacío o desalineado, lo re-registra.
 * Pensado para correr al boot del server. Si las env vars no están o PUBLIC_URL
 * falta, retorna sin tocar nada. Si llamamos a Telegram con éxito y todo OK,
 * solo loguea info; si re-registramos, lo loguea explícitamente para auditoría.
 */
export async function ensureWebhookRegistered(): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  const expectedUrl = expectedWebhookUrl()

  if (!token || !secret) {
    logger.warn('[telegram-webhook] ensureWebhookRegistered: TELEGRAM_BOT_TOKEN o TELEGRAM_WEBHOOK_SECRET ausentes — skip')
    return
  }
  if (!expectedUrl) {
    logger.warn('[telegram-webhook] ensureWebhookRegistered: PUBLIC_URL ausente — skip')
    return
  }
  // Solo auto-registramos en producción. En dev el bot vive contra `localhost`
  // y Telegram no puede entregar updates ahí — si el dev quiere webhook, debe
  // usar un túnel (ngrok/cloudflared) y setearlo manualmente.
  if (process.env.NODE_ENV !== 'production') {
    logger.info('[telegram-webhook] ensureWebhookRegistered: NODE_ENV != production — skip')
    return
  }

  const info = await callTelegram<WebhookInfo>('getWebhookInfo')
  if (!info.ok) {
    logger.error('[telegram-webhook] ensureWebhookRegistered: getWebhookInfo falló', { error: info.error })
    return
  }

  if (info.result.url === expectedUrl) {
    logger.info('[telegram-webhook] webhook alineado', {
      url: info.result.url,
      pending: info.result.pending_update_count,
    })
    return
  }

  logger.warn('[telegram-webhook] webhook desalineado — auto-registrando', {
    actual: info.result.url || '(vacío)',
    expected: expectedUrl,
  })

  const setRes = await callTelegram<boolean>('setWebhook', {
    url: expectedUrl,
    secret_token: secret,
    max_connections: 40,
    allowed_updates: ['message', 'callback_query'],
    drop_pending_updates: false,
  })

  if (!setRes.ok) {
    logger.error('[telegram-webhook] setWebhook falló', { error: setRes.error })
    return
  }

  invalidateBotHealthCache()
  logger.info('[telegram-webhook] webhook re-registrado correctamente', { url: expectedUrl })
}
