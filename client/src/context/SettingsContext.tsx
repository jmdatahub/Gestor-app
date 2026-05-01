import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react'

// ==============================================
// TYPES
// ==============================================
export type Theme = 'light' | 'dark' | 'auto'
export type Language = 'es' | 'en'
export type Density = 'compact' | 'normal' | 'large'
export type DateFormat = 'dd/MM/yyyy' | 'MM/dd/yyyy'
export type DecimalSeparator = 'comma' | 'dot'
export type Design = 'crafted' | 'mono' | 'aurora' | 'bento' | 'editorial'

export const DESIGN_OPTIONS: { value: Design; label: string; description: string; previewColors: { bg: string; surface: string; accent: string; text: string } }[] = [
  { value: 'crafted',   label: 'Premium Crafted',   description: 'Cálido tipo papel, serif Fraunces para números, sidebar light con barra violeta.', previewColors: { bg: '#FAFAF7', surface: '#FFFFFF', accent: '#5B47E0', text: '#1F1E1B' } },
  { value: 'mono',      label: 'Mono Linear',       description: 'Monocromo denso power-user. Inter Tight + JetBrains Mono. Radii muy pequeños.', previewColors: { bg: '#FFFFFF', surface: '#FAFAFA', accent: '#3D63DD', text: '#0A0A0A' } },
  { value: 'aurora',    label: 'Glass Aurora',      description: 'Dark forzado, glassmorphism, gradiente aurora rosa→violeta→azul→teal.',         previewColors: { bg: '#05050B', surface: 'rgba(255,255,255,0.06)', accent: '#B045FF', text: '#F8F9FF' } },
  { value: 'bento',     label: 'Bento Claycard',    description: 'Cremoso pastel, claymorphism, KPI grid asimétrico. Friendly y acogedor.',         previewColors: { bg: '#F4F1EA', surface: '#FFFFFF', accent: '#FF8A65', text: '#1F1B14' } },
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

const defaultSettings: AppSettings = {
  theme: 'light',
  design: 'crafted',
  language: 'es',
  density: 'normal',
  densityPercent: 50, // 25=compact, 50=normal, 75=comfortable
  dateFormat: 'dd/MM/yyyy',
  decimalSeparator: 'comma',
  notifications: defaultNotifications,
  rollupAccountsByParent: false,
  soundEnabled: true
}

const STORAGE_KEY = 'app_settings'

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
  const [settings, setSettings] = useState<AppSettings>(() => {
    // Load from localStorage on init
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        // Merge with defaults to ensure all fields exist
        return {
          ...defaultSettings,
          ...parsed,
          notifications: {
            ...defaultNotifications,
            ...(parsed.notifications || {}),
          },
          // Ensure rollupAccountsByParent exists if missing in stored
          rollupAccountsByParent: parsed.rollupAccountsByParent ?? defaultSettings.rollupAccountsByParent
        }
      }
    } catch (error) {
      console.warn('Error loading settings from localStorage:', error)
    }
    return defaultSettings
  })

  // Save to localStorage whenever settings change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    } catch (error) {
      console.warn('Error saving settings to localStorage:', error)
    }
  }, [settings])

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement
    let resolvedTheme: 'light' | 'dark'
    if (settings.theme === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      resolvedTheme = prefersDark ? 'dark' : 'light'
    } else {
      resolvedTheme = settings.theme
    }
    root.setAttribute('data-theme', resolvedTheme)
    // Mirror to standalone key so the index.html bootstrap can read it pre-React.
    try { localStorage.setItem('app_theme', resolvedTheme) } catch {}
  }, [settings.theme])

  // Apply design to document (sets `data-design` attribute on <html>)
  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-design', settings.design)
    try { localStorage.setItem('app_design', settings.design) } catch {}
    // Aurora forces dark mode visually — auto-pair to dark unless user explicitly picked light.
    // We DON'T override the user's theme preference; we only ensure data-theme is dark when on aurora
    // and theme is 'auto'. If user chose explicit light/dark, respect it.
    if (settings.design === 'aurora' && settings.theme === 'auto') {
      root.setAttribute('data-theme', 'dark')
      try { localStorage.setItem('app_theme', 'dark') } catch {}
    }
  }, [settings.design, settings.theme])

  // Apply density to document — CSS rules in base.css handle the variable values per preset
  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-density', settings.density)
    // Clear any previously-set inline overrides so the [data-density] CSS rules take effect
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
          (updated as any)[key] = (partial as any)[key]
        }
      })

      return updated
    })
  }, [])

  const resetSettings = useCallback(() => {
    setSettings(defaultSettings)
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
