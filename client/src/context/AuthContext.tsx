import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { api } from '../lib/apiClient'

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

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('auth_token'))
  const [isLoading, setIsLoading] = useState(true)

  const refreshUser = async () => {
    const t = localStorage.getItem('auth_token')
    if (!t) { setUser(null); setIsLoading(false); return }
    try {
      const { user: u } = await api.get<{ user: AuthUser }>('/api/auth/me')
      setUser(u)
    } catch {
      localStorage.removeItem('auth_token')
      setUser(null)
      setToken(null)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { refreshUser() }, [])

  const signIn = async (email: string, password: string) => {
    const { token: t, user: u } = await api.post<{ token: string; user: AuthUser }>('/api/auth/login', { email, password })
    localStorage.setItem('auth_token', t)
    setToken(t)
    setUser(u)
  }

  const signOut = () => {
    localStorage.removeItem('auth_token')
    setToken(null)
    setUser(null)
    api.post('/api/auth/logout').catch(() => {})
  }

  return (
    <AuthContext.Provider value={{ user, token, isLoading, signIn, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
