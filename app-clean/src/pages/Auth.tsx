import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { ensureDefaultAccountsForUser } from '../services/authService'
import { TrendingUp, TrendingDown, Wallet, PiggyBank, Shield, BarChart3, AlertTriangle } from 'lucide-react'
import { UiInput } from '../components/ui/UiInput'

export default function Auth() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSuspendedMessage, setShowSuspendedMessage] = useState(false)

  // Check if user was redirected due to suspension
  useEffect(() => {
    if (searchParams.get('suspended') === 'true') {
      setShowSuspendedMessage(true)
    }
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        
        // Check if user is suspended before proceeding
        if (data.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('is_suspended')
            .eq('id', data.user.id)
            .single()
          
          if (profile?.is_suspended) {
            await supabase.auth.signOut()
            setError('Tu cuenta ha sido suspendida. Contacta al administrador para más información.')
            return
          }
          
          await ensureDefaultAccountsForUser(data.user.id)
        }
        navigate('/app/dashboard')
      } else {
        // Usa VITE_SITE_URL se está configurada, senón usa o orixe actual
        const siteUrl = import.meta.env.VITE_SITE_URL || window.location.origin
        const { data, error } = await supabase.auth.signUp({ 
          email, 
          password,
          options: {
            emailRedirectTo: `${siteUrl}/auth`
          }
        })
        if (error) throw error
        if (data.user) {
          await ensureDefaultAccountsForUser(data.user.id)
          navigate('/app/dashboard')
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ha ocurrido un error')
    } finally {
      setLoading(false)
    }
  }

  const features = [
    { icon: TrendingUp, text: 'Registra todos tus ingresos' },
    { icon: TrendingDown, text: 'Controla tus gastos diarios' },
    { icon: PiggyBank, text: 'Gestiona tus objetivos de ahorro' },
    { icon: BarChart3, text: 'Visualiza insights financieros' },
  ]

  return (
    <div className="auth-split-layout">
      {/* Branding Panel */}
      <div className="auth-branding">
        <div className="auth-branding-content">
          {/* Logo */}
          <div className="auth-branding-logo">
            <div className="auth-branding-badge">
              <Wallet size={28} />
            </div>
          </div>

          {/* Title */}
          <h1 className="auth-branding-title">
            Mi Panel Financiero
          </h1>
          <p className="auth-branding-subtitle">
            Controla tus ingresos, gastos e inversiones desde un solo lugar.
          </p>

          {/* Features */}
          <div className="auth-features">
            {features.map((feature, index) => (
              <div key={index} className="auth-feature">
                <div className="auth-feature-icon">
                  <feature.icon size={20} />
                </div>
                <span>{feature.text}</span>
              </div>
            ))}
          </div>

          {/* Decorative elements */}
          <div className="auth-decoration">
            <div className="auth-decoration-card auth-decoration-card-1">
              <div className="auth-decoration-card-header"></div>
              <div className="auth-decoration-card-line"></div>
              <div className="auth-decoration-card-line short"></div>
            </div>
            <div className="auth-decoration-card auth-decoration-card-2">
              <div className="auth-decoration-card-header"></div>
              <div className="auth-decoration-card-line"></div>
              <div className="auth-decoration-card-line short"></div>
            </div>
          </div>
        </div>

        {/* Security badge */}
        <div className="auth-security">
          <Shield size={16} />
          <span>Conexión segura con encriptación SSL</span>
        </div>
      </div>

      {/* Login Panel */}
      <div className="auth-form-panel">
        <div className="auth-form-container">
          {/* Mobile Logo */}
          <div className="auth-mobile-logo">
            <div className="auth-branding-badge">
              <Wallet size={24} />
            </div>
            <span>Mi Panel Financiero</span>
          </div>

          {/* Form Card */}
          <div className={`auth-form-card ${isLogin ? 'mode-login' : 'mode-register'}`}>
            <div className="auth-form-header">
              <h2 className="auth-form-title">
                {isLogin ? 'Bienvenido de nuevo' : 'Crea tu cuenta'}
              </h2>
              <p className="auth-form-subtitle">
                {isLogin 
                  ? 'Ingresa tus credenciales para continuar'
                  : 'Regístrate para empezar a gestionar tus finanzas'
                }
              </p>
            </div>

            <form onSubmit={handleSubmit} className="auth-form">
              {showSuspendedMessage && (
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  padding: '16px',
                  marginBottom: '16px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '12px',
                  color: '#ef4444'
                }}>
                  <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <strong style={{ display: 'block', marginBottom: 4 }}>Cuenta Suspendida</strong>
                    <span style={{ fontSize: '0.875rem', color: 'rgba(239, 68, 68, 0.8)' }}>
                      Tu cuenta ha sido suspendida por un administrador. 
                      Si crees que es un error, contacta con soporte.
                    </span>
                  </div>
                </div>
              )}
              
              {error && (
                <div className="auth-error">
                  {error}
                </div>
              )}

              <div className="mb-4">
                <UiInput
                  id="email"
                  type="email"
                  label="Correo electrónico"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  required
                />
              </div>

              <div className="mb-6">
                <UiInput
                  id="password"
                  type="password"
                  label="Contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  hint={!isLogin ? "Mínimo 6 caracteres" : undefined}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-lg w-full"
                disabled={loading}
              >
                {loading 
                  ? 'Procesando...' 
                  : isLogin 
                    ? 'Iniciar Sesión' 
                    : 'Crear Cuenta'
                }
              </button>
            </form>

            <div className="auth-form-footer">
              <span className="auth-footer-text">
                {isLogin ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin)
                  setError(null)
                }}
                className="auth-toggle-btn"
              >
                {isLogin ? 'Regístrate gratis' : 'Inicia sesión'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
