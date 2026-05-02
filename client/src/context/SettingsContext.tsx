import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { storage } from '../lib/storage'

// ==============================================
// TYPES
// ==============================================
export type Theme = 'light' | 'dark' | 'auto'
export type Language = 'es' | 'en'
export type Density = 'compact' | 'normal' | 'large'
export type DateFormat = 'dd/MM/yyyy' | 'MM/dd/yyyy'
export type DecimalSeparator = 'comma' | 'dot'
export type Design = 'original' | 'crafted' | 'mono' | 'aurora' | 'bento' | 'editorial'

export const DESIGN_OPTIONS: { value: Design; label: string; description: string; previewColors: { bg: string; surface: string; accent: string; text: string } }[] = [
  { value: 'original',  label: 'Original',          description: 'El estilo de siempre: sidebar oscuro, gradiente indigo, paleta clásica.',           previewColors: { bg: '#F3F4F6', surface: '#FFFFFF', accent: '#4F46E5', text: '#0F172A' } },
  { value: 'crafted',   label: 'Premium Crafted',   description: 'Cálido tipo papel, serif Fraunces para números, sidebar light con barra violeta.', previewColors: { bg: '#FAFAF7', surface: '#FFFFFF', accent: '#5B47E0', text: '#1F1E1B' } },
  { value: 'mono',      label: 'Mono Linear',       description: 'Monocromo denso power-user. Inter Tight + JetBrains Mono. Radii muy pequeños.',    previewColors: { bg: '#FFFFFF', surface: '#FAFAFA', accent: '#3D63DD', text: '#0A0A0A' } },
  { value: 'aurora',    label: 'Glass Aurora',      description: 'Dark forzado, glassmorphism, gradiente aurora rosa→violeta→azul→teal.',           previewColors: { bg: '#05050B', surface: 'rgba(255,255,255,0.06)', accent: '#B045FF', text: '#F8F9FF' } },
  { value: 'bento',     label: 'Bento Claycard',    description: 'Cremoso pastel, claymorphism, KPI grid asimétrico. Friendly y acogedor.',           previewColors: { bg: '#F4F1EA', surface: '#FFFFFF', accent: '#FF8A65', text: '#1F1F14' } },
  { value: 'editorial', label: 'Editorial Magazine',description: 'Tipografía Fraunces gigante, oxblood + cream, hairlines negras, radii 0.',          previewColors: { bg: '#F2EEE6', surface: '#FFFFFF', accent: '#7C2128', text: '#0A0908' } },
]

export interface NotificationSettings {
  highSpending: boolean
  recurring: boolean
  savingsGoals: boolean
  upcomingDebts: boolean
  investments: boolean
}

export interface AppSettings {
  theme: Theme
  design: Design
  language: Language
  density: Density
  densityPercent: number // 0-100, where 25=compact, 50=normal, 75=comfortable
  dateFormat: DateFormat
  decimalSeparator: DecimalSeparator
  notifications: NotificationSettings
  rollupAccountsByParent: boolean
  soundEnabled: boolean
}

// ==============================================
// DEFAULTS
// ==============================================
const defaultNotifications: NotificationSettings = {
  highSpending: true,
  recurring: true,
  savingsGoals: true,
  upcomingDebts: true,
  investments: true,
}

export const defaultSettings: AppSettings = {
  theme: 'light',
  design: 'original',
  language: 'es',
  density: 'normal',
  densityPercent: 50, // 25=compact, 50=normal, 75=comfortable
  dateFormat: 'dd/MM/yyyy',
  decimalSeparator: 'comma',
  notifications: defaultNotifications,
  rollupAccountsByParent: false,
  soundEnabled: true,
}

// Namespaced storage keys (fix #6 — prevents dev/prod collision).
const STORAGE_KEY = 'app_settings'
const DESIGN_INIT_KEY = 'design_v2_react_init'
/** Broadcast key: written when settings change so other tabs can sync. */
const SETTINGS_BROADCAST_KEY = 'settings_updated'

function loadSettingsFromStorage(): AppSettings {
  try {
    const stored = storage.get(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      // Migration: reset 'crafted' (silent old default) back to 'original'.
      let design = parsed.design as Design | undefined
      if (!storage.get(DESIGN_INIT_KEY)) {
        if (design === 'crafted') design = 'original'
        storage.set(DESIGN_INIT_KEY, '1')
      }
      return {
        ...defaultSettings,
        ...parsed,
        design: design ?? defaultSettings.design,
        notifications: {
          ...defaultNotifications,
          ...(parsed.notifications || {}),
        },
        rollupAccountsByParent: parsed.rollupAccountsByParent ?? defaultSettings.rollupAccountsByParent,
      }
    }
  } catch (error) {
    console.warn('Error loading settings from localStorage:', error)
  }
  return defaultSettings
}

// ==============================================
// CONTEXT
// ==============================================
interface SettingsContextType {
  settings: AppSettings
  updateSettings: (partial: Partial<AppSettings>) => void
  resetSettings: () => void
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined)

// ==============================================
// PROVIDER
// ==============================================
interface SettingsProviderProps {
  children: ReactNode
}

export function SettingsProvider({ children }: SettingsProviderProps) {
  const { user } = useAuth()
  const [settings, setSettings] = useState<AppSettings>(loadSettingsFromStorage)

  // ---------------------------------------------------------------------------
  // Reset settings when the user logs out (fix #3).
  // We reset in-memory state to defaults so the next user that logs in (in the
  // same tab) starts with a clean slate. The localStorage entry is left intact
  // so the PREVIOUS user's preferences are still there when they log back in.
  // If you want a full wipe instead, call `storage.remove(STORAGE_KEY)` here.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!user) {
      setSettings(defaultSettings)
    } else {
      // Re-load persisted settings when a user logs in (fix #9 – at minimum
      // we load from localStorage; server-sync can be layered on top of this).
      setSettings(loadSettingsFromStorage())
    }
  }, [user])

  // ---------------------------------------------------------------------------
  // Persist to localStorage whenever settings change
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!user) return // Don't persist the reset-to-defaults state back to storage.
    try {
      storage.set(STORAGE_KEY, JSON.stringify(settings))
      // Mirror lightweight keys for the pre-React bootstrap in index.html.
      storage.set('app_theme', getResolvedTheme(settings))
      storage.set('app_design', settings.design)
    } catch (error) {
      console.warn('Error saving settings to localStorage:', error)
    }
  }, [settings, user])

  // ---------------------------------------------------------------------------
  // Cross-tab settings sync
  // When this tab updates settings, broadcast the change so other tabs apply it.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key !== storage.key(SETTINGS_BROADCAST_KEY) || !e.newValue) return
      // Another tab changed settings — reload from storage.
      setSettings(loadSettingsFromStorage())
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  // ---------------------------------------------------------------------------
  // Apply theme to document
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const root = document.documentElement
    const resolvedTheme = getResolvedTheme(settings)
    root.setAttribute('data-theme', resolvedTheme)
    try { storage.set('app_theme', resolvedTheme) } catch {}
  }, [settings.theme])

  // Apply design to document (sets `data-design` attribute on <html>)
  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-design', settings.design)
    try { storage.set('app_design', settings.design) } catch {}
    // Aurora forces dark mode visually — auto-pair to dark unless user explicitly picked light.
    if (settings.design === 'aurora' && settings.theme === 'auto') {
      root.setAttribute('data-theme', 'dark')
      try { storage.set('app_theme', 'dark') } catch {}
    }
  }, [settings.design, settings.theme])

  // Apply density to document
  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-density', settings.density)
    root.style.removeProperty('--spacing-page')
    root.style.removeProperty('--spacing-card')
    root.style.removeProperty('--control-height')
    root.style.removeProperty('--table-row-pad')
  }, [settings.density])

  const updateSettings = useCallback((partial: Partial<AppSettings>) => {
    setSettings(prev => {
      const updated = { ...prev }

      // Handle nested notifications object
      if (partial.notifications) {
        updated.notifications = {
          ...prev.notifications,
          ...partial.notifications,
        }
      }

      // Apply other settings
      Object.keys(partial).forEach(key => {
        if (key !== 'notifications') {
          (updated as unknown as Record<string, unknown>)[key] = (partial as Record<string, unknown>)[key]
        }
      })

      return updated
    })
    // Broadcast to other tabs.
    storage.set(SETTINGS_BROADCAST_KEY, String(Date.now()))
    storage.remove(SETTINGS_BROADCAST_KEY)
  }, [])

  const resetSettings = useCallback(() => {
    setSettings(defaultSettings)
    storage.set(SETTINGS_BROADCAST_KEY, String(Date.now()))
    storage.remove(SETTINGS_BROADCAST_KEY)
  }, [])

  const value = useMemo(
    () => ({ settings, updateSettings, resetSettings }),
    [settings, updateSettings, resetSettings],
  )

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  )
}

// ==============================================
// HELPERS
// ==============================================
function getResolvedTheme(settings: AppSettings): 'light' | 'dark' {
  if (settings.theme === 'auto') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return settings.theme
}

// ==============================================
// HOOK
// ==============================================
export function useSettings() {
  const context = useContext(SettingsContext)
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider')
  }
  return context
}

// ==============================================
// UTILITY FUNCTIONS
// ==============================================

/**
 * Format a number according to the decimal separator setting
 */
export function formatNumber(value: number, separator: DecimalSeparator): string {
  const formatted = value.toFixed(2)
  if (separator === 'comma') {
    return formatted.replace('.', ',')
  }
  return formatted
}

/**
 * Format a date according to the date format setting
 */
export function formatDate(date: Date | string, format: DateFormat): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const day = d.getDate().toString().padStart(2, '0')
  const month = (d.getMonth() + 1).toString().padStart(2, '0')
  const year = d.getFullYear()

  if (format === 'dd/MM/yyyy') {
    return `${day}/${month}/${year}`
  }
  return `${month}/${day}/${year}`
}

/**
 * Get translated label based on language
 */
export function getLabel(key: string, language: Language): string {
  const labels: Record<string, Record<Language, string>> = {
    dashboard: { es: 'Dashboard', en: 'Dashboard' },
    movements: { es: 'Movimientos', en: 'Movements' },
    accounts: { es: 'Cuentas', en: 'Accounts' },
    savings: { es: 'Ahorro', en: 'Savings' },
    investments: { es: 'Inversiones', en: 'Investments' },
    debts: { es: 'Deudas', en: 'Debts' },
    settings: { es: 'Ajustes', en: 'Settings' },
    logout: { es: 'Cerrar Sesión', en: 'Log Out' },
    income: { es: 'Ingresos', en: 'Income' },
    expenses: { es: 'Gastos', en: 'Expenses' },
    balance: { es: 'Balance', en: 'Balance' },
    save: { es: 'Guardar', en: 'Save' },
    cancel: { es: 'Cancelar', en: 'Cancel' },
    create: { es: 'Crear', en: 'Create' },
    edit: { es: 'Editar', en: 'Edit' },
    delete: { es: 'Eliminar', en: 'Delete' },
  }

  return labels[key]?.[language] || key
}
