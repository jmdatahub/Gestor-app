import { useState, useEffect, useCallback } from 'react'
import { MessageCircle, CheckCircle2, ExternalLink, Loader2, QrCode, RefreshCw } from 'lucide-react'
import { createApiToken } from '../../services/apiTokenService'
import { useAuth } from '../../context/AuthContext'
import { api } from '../../lib/apiClient'

const TELEGRAM_BOT = 'GestorJorgePersonalBot'

type ProfileMe = {
  id: string
  email: string | null
  telegram_chat_id?: string | null
  telegramChatId?: string | null
}

function getChatId(p: ProfileMe | null): string | null {
  if (!p) return null
  return (p.telegram_chat_id ?? p.telegramChatId ?? null) || null
}

type ConnectFlow = {
  url: string
  token: string
}

export function TelegramConnect() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<ProfileMe | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [flow, setFlow] = useState<ConnectFlow | null>(null)

  const fetchProfile = useCallback(async () => {
    try {
      const { data } = await api.get<{ data: ProfileMe }>('/api/v1/profiles/me')
      setProfile(data)
    } catch {
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!user) return
    fetchProfile()
  }, [user, fetchProfile])

  const startConnect = async () => {
    if (!user) return
    setCreating(true)
    try {
      const { token } = await createApiToken(user.id, {
        name: 'Telegram Bot',
        organization_id: null,
        scopes: ['movements:read', 'movements:write', 'categories:read', 'categories:write'],
      })
      const url = `https://t.me/${TELEGRAM_BOT}?start=${token}`
      setFlow({ url, token })
    } catch {
      // silent — user can retry
    } finally {
      setCreating(false)
    }
  }

  const isConnected = !!getChatId(profile)

  if (loading) {
    return (
      <div className="tg-card tg-card--loading">
        <Loader2 size={16} className="tg-spinner" />
        <span>Comprobando…</span>
      </div>
    )
  }

  // ── CONNECTED STATE ──────────────────────────────────────────
  if (isConnected) {
    return (
      <div className="tg-card tg-card--connected">
        <div className="tg-icon tg-icon--connected" aria-hidden="true">
          <CheckCircle2 size={20} />
        </div>
        <div className="tg-body">
          <div className="tg-title">Telegram conectado</div>
          <div className="tg-subtitle">
            Registra gastos y recibe alertas desde el bot
          </div>
        </div>
        <a
          href={`https://t.me/${TELEGRAM_BOT}`}
          target="_blank"
          rel="noopener noreferrer"
          className="tg-btn tg-btn--ghost"
        >
          Abrir bot <ExternalLink size={12} />
        </a>
      </div>
    )
  }

  // ── DISCONNECTED — flow active (QR + link) ───────────────────
  if (flow) {
    // Validate that the URL starts with https:// to prevent javascript:/data: injection
    const safeFlowUrl = flow.url.startsWith('https://') ? flow.url : '#'
    const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&data=${encodeURIComponent(safeFlowUrl)}`
    return (
      <div className="tg-card tg-card--flow">
        <div className="tg-flow-header">
          <div className="tg-icon tg-icon--brand" aria-hidden="true">
            <MessageCircle size={20} />
          </div>
          <div className="tg-body">
            <div className="tg-title">Conecta tu Telegram</div>
            <div className="tg-subtitle">
              Pulsa para abrir el bot, o escanea el QR desde tu móvil.
            </div>
          </div>
          <button
            type="button"
            className="tg-btn tg-btn--ghost"
            onClick={() => { setFlow(null); fetchProfile() }}
            title="Cancelar / verificar conexión"
            aria-label="Cancelar y verificar conexión"
          >
            <RefreshCw size={14} />
          </button>
        </div>

        <div className="tg-flow-body">
          <div className="tg-qr">
            <img
              src={qrSrc}
              alt="QR para conectar Telegram"
              width={180}
              height={180}
              loading="lazy"
            />
            <div className="tg-qr-label">
              <QrCode size={12} />
              <span>Escanea desde el móvil</span>
            </div>
          </div>

          <div className="tg-flow-actions">
            <a
              href={safeFlowUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="tg-btn tg-btn--brand"
            >
              <MessageCircle size={14} />
              Abrir Telegram
            </a>
            <div className="tg-hint">
              <strong>O</strong> abre Telegram → busca <code>@{TELEGRAM_BOT}</code> → envía <code>/start</code>.
            </div>
            <button
              type="button"
              className="tg-btn tg-btn--ghost tg-btn--sm"
              onClick={() => { setFlow(null); fetchProfile() }}
            >
              Ya he conectado, comprobar
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── DISCONNECTED — initial state ─────────────────────────────
  return (
    <div className="tg-card tg-card--disconnected">
      <div className="tg-icon tg-icon--brand" aria-hidden="true">
        <MessageCircle size={20} />
      </div>
      <div className="tg-body">
        <div className="tg-title">Conectar Telegram</div>
        <div className="tg-subtitle">
          Registra gastos e ingresos desde el chat
        </div>
      </div>
      <button
        type="button"
        className="tg-btn tg-btn--brand"
        onClick={startConnect}
        disabled={creating}
      >
        {creating ? (
          <>
            <Loader2 size={14} className="tg-spinner" /> Generando…
          </>
        ) : (
          <>
            <MessageCircle size={14} /> Conectar
          </>
        )}
      </button>
    </div>
  )
}
