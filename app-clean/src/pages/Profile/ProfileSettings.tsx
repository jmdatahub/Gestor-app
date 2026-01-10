import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { User, Check, Save, Loader2, Mail, AlertCircle, CheckCircle2 } from 'lucide-react'

// Avatares predefinidos por categorías
const AVATAR_CATEGORIES = {
  animales: ['🐱', '🐶', '🦊', '🐻', '🐼', '🦁', '🐮', '🐷', '🐸', '🐵', '🐰', '🦄'],
  objetos: ['🚀', '⭐', '🌙', '🔥', '💎', '🎯', '🎨', '🎵', '📚', '💡', '🎮', '🏆'],
  naturaleza: ['🌸', '🌺', '🌻', '🍀', '🌴', '🌊', '⛰️', '🌈', '❄️', '☀️', '🌵', '🍄'],
  colores: ['🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚫', '⚪', '🟤', '💜', '💙', '💚']
}

const BACKGROUND_COLORS = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444', '#f97316', '#eab308',
  '#22c55e', '#14b8a6', '#06b6d4', '#6366f1', '#a855f7', '#f43f5e'
]

interface UserProfile {
  id: string
  email: string | null
  display_name: string | null
  avatar_type: string | null
  created_at?: string
}

export default function ProfileSettings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [authEmail, setAuthEmail] = useState<string | null>(null) // Email from auth.user
  const [displayName, setDisplayName] = useState('')
  const [avatarType, setAvatarType] = useState('default')
  const [avatarBg, setAvatarBg] = useState('#3b82f6')
  
  // Email change state
  const [newEmail, setNewEmail] = useState('')
  const [emailSending, setEmailSending] = useState(false)
  const [emailMessage, setEmailMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Get email from auth.user (this is always correct)
      setAuthEmail(user.email || null)

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error) {
        console.error('Error loading profile:', error)
        setProfile({ id: user.id, email: user.email || null, display_name: null, avatar_type: null })
        setDisplayName(user.email?.split('@')[0] || '')
        return
      }

      setProfile(data)
      setDisplayName(data.display_name || user.email?.split('@')[0] || '')
      
      if (data.avatar_type) {
        if (data.avatar_type.startsWith('emoji:')) {
          setAvatarType(data.avatar_type.split(':')[1])
        } else if (data.avatar_type.startsWith('bg:')) {
          setAvatarBg(data.avatar_type.split(':')[1])
          setAvatarType('default')
        } else {
          setAvatarType(data.avatar_type)
        }
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!profile) return
    setSaving(true)
    setSaved(false)

    try {
      const avatarValue = avatarType === 'default' ? `bg:${avatarBg}` : `emoji:${avatarType}`
      
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: displayName.trim() || null,
          avatar_type: avatarValue
        })
        .eq('id', profile.id)

      if (error) throw error
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (error) {
      console.error('Error saving profile:', error)
      alert('Error al guardar el perfil')
    } finally {
      setSaving(false)
    }
  }

  const handleEmailChange = async () => {
    if (!newEmail || !newEmail.includes('@')) {
      setEmailMessage({ type: 'error', text: 'Introduce un email válido' })
      return
    }
    
    setEmailSending(true)
    setEmailMessage(null)
    
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail })
      
      if (error) {
        setEmailMessage({ type: 'error', text: error.message })
      } else {
        setEmailMessage({ 
          type: 'success', 
          text: 'Se ha enviado un enlace de verificación a ambos emails. Confirma el cambio desde tu bandeja de entrada.' 
        })
        setNewEmail('')
      }
    } catch (error: any) {
      setEmailMessage({ type: 'error', text: error.message || 'Error al cambiar email' })
    } finally {
      setEmailSending(false)
    }
  }

  const isEmoji = avatarType !== 'default' && avatarType.length <= 2
  const formatDate = (date?: string) => date ? new Date(date).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }) : '-'

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
        <div style={{ width: 32, height: 32, border: '3px solid #334155', borderTopColor: '#10b981', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
      </div>
    )
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '0 24px 100px' }}>
      <div style={{ maxWidth: 700, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32, paddingTop: 8 }}>
          <div style={{ width: 40, height: 40, background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <User size={20} color="white" />
          </div>
          <div>
            <h1 style={{ color: 'white', fontSize: 22, fontWeight: 700, margin: 0 }}>Mi Perfil</h1>
            <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>Personaliza tu cuenta</p>
          </div>
        </div>

        {/* Avatar Preview Card */}
        <div style={{ background: '#1e293b', borderRadius: 20, padding: 32, border: '1px solid #334155', marginBottom: 24, textAlign: 'center' }}>
          <div style={{ 
            width: 100, height: 100, borderRadius: 24, margin: '0 auto 16px',
            background: isEmoji ? '#0f172a' : avatarBg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: isEmoji ? 48 : 36, fontWeight: 700, color: 'white',
            border: '4px solid #334155', boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
          }}>
            {isEmoji ? avatarType : (displayName || authEmail || '?').charAt(0).toUpperCase()}
          </div>
          <h2 style={{ color: 'white', fontSize: 20, fontWeight: 700, margin: '0 0 4px' }}>
            {displayName || 'Sin nombre'}
          </h2>
          <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>{authEmail || 'Sin email'}</p>
          {profile?.created_at && (
            <p style={{ color: '#475569', fontSize: 12, marginTop: 8 }}>
              Miembro desde {formatDate(profile.created_at)}
            </p>
          )}
        </div>

        {/* Account Info Section */}
        <div style={{ background: '#1e293b', borderRadius: 16, padding: 24, border: '1px solid #334155', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <Mail size={18} color="#6366f1" />
            <h3 style={{ color: 'white', fontSize: 16, fontWeight: 700, margin: 0 }}>Información de la Cuenta</h3>
          </div>
          
          {/* Current Email (Read-only) */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
              Email Actual
            </label>
            <div style={{ padding: '14px 16px', background: '#0f172a', border: '1px solid #334155', borderRadius: 12, color: '#10b981', fontSize: 15, fontWeight: 600 }}>
              {authEmail || 'No disponible'}
            </div>
          </div>
          
          {/* Change Email */}
          <div>
            <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
              Cambiar Email
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="nuevo@email.com"
                style={{
                  flex: 1, padding: '14px 16px', background: '#0f172a', border: '1px solid #334155',
                  borderRadius: 12, color: 'white', fontSize: 15, outline: 'none'
                }}
              />
              <button
                onClick={handleEmailChange}
                disabled={emailSending || !newEmail}
                style={{
                  padding: '14px 20px', background: emailSending ? '#334155' : '#6366f1',
                  border: 'none', borderRadius: 12, color: 'white', fontSize: 14, fontWeight: 600,
                  cursor: emailSending || !newEmail ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap'
                }}
              >
                {emailSending ? 'Enviando...' : 'Enviar Verificación'}
              </button>
            </div>
            {emailMessage && (
              <div style={{ 
                display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, padding: '12px 16px',
                background: emailMessage.type === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                border: `1px solid ${emailMessage.type === 'success' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
                borderRadius: 10, color: emailMessage.type === 'success' ? '#22c55e' : '#ef4444', fontSize: 13
              }}>
                {emailMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                {emailMessage.text}
              </div>
            )}
            <p style={{ color: '#64748b', fontSize: 12, marginTop: 8 }}>
              Se enviará un enlace de verificación a tu email actual y al nuevo.
            </p>
          </div>
        </div>

        {/* Display Name */}
        <div style={{ background: '#1e293b', borderRadius: 16, padding: 24, border: '1px solid #334155', marginBottom: 24 }}>
          <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
            Nombre de Usuario
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Tu nombre o apodo"
            style={{
              width: '100%', padding: '14px 16px', background: '#0f172a', border: '1px solid #334155',
              borderRadius: 12, color: 'white', fontSize: 16, outline: 'none'
            }}
          />
          <p style={{ color: '#64748b', fontSize: 12, marginTop: 8 }}>
            Este nombre se mostrará en la aplicación
          </p>
        </div>

        {/* Avatar Selection */}
        <div style={{ background: '#1e293b', borderRadius: 16, padding: 24, border: '1px solid #334155', marginBottom: 24 }}>
          <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>
            Elige tu Avatar
          </label>

          {/* Default (Initials) Option */}
          <div style={{ marginBottom: 20 }}>
            <p style={{ color: '#64748b', fontSize: 12, marginBottom: 10 }}>Iniciales con color</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {BACKGROUND_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => { setAvatarType('default'); setAvatarBg(color) }}
                  style={{
                    width: 44, height: 44, borderRadius: 12, border: avatarType === 'default' && avatarBg === color ? '3px solid #10b981' : '2px solid #334155',
                    background: color, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer', transition: 'transform 0.15s',
                    transform: avatarType === 'default' && avatarBg === color ? 'scale(1.1)' : 'scale(1)'
                  }}
                >
                  {(displayName || authEmail || '?').charAt(0).toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Emoji Categories */}
          {Object.entries(AVATAR_CATEGORIES).map(([category, emojis]) => (
            <div key={category} style={{ marginBottom: 20 }}>
              <p style={{ color: '#64748b', fontSize: 12, marginBottom: 10, textTransform: 'capitalize' }}>{category}</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {emojis.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => setAvatarType(emoji)}
                    style={{
                      width: 44, height: 44, borderRadius: 12, border: avatarType === emoji ? '3px solid #10b981' : '2px solid #334155',
                      background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 24, cursor: 'pointer', transition: 'transform 0.15s',
                      transform: avatarType === emoji ? 'scale(1.1)' : 'scale(1)'
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Save Button - Fixed at bottom */}
        <div style={{ 
          position: 'sticky', bottom: 24, background: 'linear-gradient(to top, #0f172a 60%, transparent)',
          paddingTop: 24, marginTop: -24
        }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              width: '100%', padding: '16px 24px', background: saved ? '#22c55e' : '#10b981',
              border: 'none', borderRadius: 12, color: 'white', fontSize: 16, fontWeight: 700,
              cursor: saving ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'background 0.2s', boxShadow: '0 4px 20px rgba(16,185,129,0.3)'
            }}
          >
            {saving ? (
              <>
                <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
                Guardando...
              </>
            ) : saved ? (
              <>
                <Check size={20} />
                ¡Guardado!
              </>
            ) : (
              <>
                <Save size={20} />
                Guardar Cambios
              </>
            )}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
