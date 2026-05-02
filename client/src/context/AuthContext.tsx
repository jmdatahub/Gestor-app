import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
} from 'react'
import { api } from '../lib/apiClient'
import { queryClient } from '../lib/queryClient'
import { storage } from '../lib/storage'

// ---------------------------------------------------------------------------
// Security note – token storage trade-off
// ---------------------------------------------------------------------------
// The auth token is stored in localStorage (not an HttpOnly cookie) so that
// the SPA can attach it as a Bearer header via JavaScript. This makes it
// readable by any JS running on the same origin (XSS risk). The alternative
// is an HttpOnly cookie that the browser attaches automatically, which is
// immune to XSS but requires CSRF protection and same-site / CORS setup on
// the server.
//
// Current stance: the app runs on a single origin, CSP headers + input
// sanitisation are the primary XSS mitigations. If the threat model changes
// (e.g. user-generated HTML), switch to HttpOnly cookies and enable the
// /api/auth/csrf endpoint.
// ---------------------------------------------------------------------------

export interface AuthUser {
  id: string
  email: string
  name: string | null
  role: string
  avatarUrl: string | null
}

interface AuthContextType {
  user: AuthUser | null
  token: string | null
  isLoading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => void
  refreshUser: () => Promise<void>
}

/** Storage key for the auth token (namespaced to avoid dev/prod collisions). */
const TOKEN_KEY = 'auth_token'

/**
 * Key written to localStorage when the user logs out.
 * Other tabs watch for this key change via the `storage` event and redirect.
 */
const LOGOUT_BROADCAST_KEY = 'auth_logout'

/**
 * Key written to localStorage when the user logs in.
 * Other tabs pick this up and re-initialise their auth state.
 */
const LOGIN_BROADCAST_KEY = 'auth_login'

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null)
  // Initialise token synchronously so the first render already knows whether
  // a token exists — this prevents the "flash of unauthenticated content"
  // when the user navigates back after logout (fix #8).
  const [token, setToken] = useState<string | null>(() => storage.get(TOKEN_KEY))
  // isLoading starts true so AppLayout shows a spinner instead of briefly
  // rendering protected content before the /me check completes (fix #8).
  const [isLoading, setIsLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    const t = storage.get(TOKEN_KEY)
    if (!t) { setUser(null); setIsLoading(false); return }
    try {
      const { user: u } = await api.get<{ user: AuthUser }>('/api/auth/me')
      setUser(u)
    } catch {
      storage.remove(TOKEN_KEY)
      setUser(null)
      setToken(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { refreshUser() }, [refreshUser])

  // ---------------------------------------------------------------------------
  // Cross-tab sync (fix #4 – logout; fix #5 handled in WorkspaceContext)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === storage.key(LOGOUT_BROADCAST_KEY)) {
        // Another tab logged out — clear state and redirect.
        setUser(null)
        setToken(null)
        queryClient.clear()
        if (!window.location.pathname.startsWith('/auth')) {
          window.location.href = '/auth'
        }
      }

      if (e.key === storage.key(LOGIN_BROADCAST_KEY) && e.newValue) {
        // Another tab logged in — re-validate our state so both tabs are in sync.
        refreshUser()
      }
    }

    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [refreshUser])

  // ---------------------------------------------------------------------------
  // Sign in
  // ---------------------------------------------------------------------------
  const signIn = useCallback(async (email: string, password: string) => {
    const { token: t, user: u } = await api.post<{ token: string; user: AuthUser }>(
      '/api/auth/login',
      { email, password },
    )
    storage.set(TOKEN_KEY, t)
    setToken(t)
    setUser(u)

    // Notify other tabs that a login happened.
    storage.set(LOGIN_BROADCAST_KEY, String(Date.now()))
    storage.remove(LOGIN_BROADCAST_KEY) // Remove immediately; the event already fired.
  }, [])

  // ---------------------------------------------------------------------------
  // Sign out (fix #1 – clear React Query cache; fix #2 – workspace reset via
  // user becoming null; fix #3 – settings reset handled in SettingsContext)
  // ---------------------------------------------------------------------------
  const signOut = useCallback(() => {
    storage.remove(TOKEN_KEY)
    // Broadcast logout to other tabs BEFORE clearing local state so the key
    // is visible to the StorageEvent listener in those tabs (fix #4).
    storage.set(LOGOUT_BROADCAST_KEY, String(Date.now()))
    storage.remove(LOGOUT_BROADCAST_KEY)

    setToken(null)
    setUser(null)

    // Clear the entire React Query cache so a subsequent login (possibly with a
    // different account) never sees stale data from the previous session (fix #1).
    queryClient.clear()

    // Clear workspace/UI preferences so next user starts fresh (fix: stale workspace cache)
    storage.remove('last_workspace_id')
    // Sidebar keys are written with raw localStorage (not namespaced) — remove both ways
    storage.remove('sidebarWidth')
    storage.remove('sidebarCollapsed')
    try {
      localStorage.removeItem('sidebarWidth')
      localStorage.removeItem('sidebarCollapsed')
    } catch { /* ignore */ }

    api.post('/api/auth/logout').catch(() => {})
  }, [])

  const value = useMemo(
    () => ({ user, token, isLoading, signIn, signOut, refreshUser }),
    [user, token, isLoading, signIn, signOut, refreshUser],
  )

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
