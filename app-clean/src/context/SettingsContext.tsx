import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

// ==============================================
// TYPES
// ==============================================
export type Theme = 'light' | 'dark' | 'auto'
export type Language = 'es' | 'en'
export type Density = 'compact' | 'normal' | 'large'
export type DateFormat = 'dd/MM/yyyy' | 'MM/dd/yyyy'
export type DecimalSeparator = 'comma' | 'dot'

export interface NotificationSettings {
  highSpending: boolean
  recurring: boolean
  savingsGoals: boolean
  upcomingDebts: boolean
  investments: boolean
}

export interface AppSettings {
  theme: Theme
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
    
    if (settings.theme === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      root.setAttribute('data-theme', prefersDark ? 'dark' : 'light')
    } else {
      root.setAttribute('data-theme', settings.theme)
    }
  }, [settings.theme])

  // Apply density to document (preset + fine-grained percentage)
  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-density', settings.density)
    
    // Apply fine-grained density based on percentage (0-100)
    // Range: 0 = ultra-compact, 50 = normal, 100 = ultra-comfortable
    const pct = settings.densityPercent ?? 50
    const factor = pct / 50 // 0.5 at 25%, 1.0 at 50%, 1.5 at 75%
    
    // Calculate dynamic values based on percentage
    const spacingPage = Math.round(14 + (factor * 6)) // 14-26px
    const spacingCard = Math.round(12 + (factor * 5)) // 12-22px
    const controlHeight = Math.round(34 + (factor * 6)) // 34-46px
    const tableRowPad = Math.round(8 + (factor * 4)) // 8-16px
    
    root.style.setProperty('--spacing-page', `${spacingPage}px`)
    root.style.setProperty('--spacing-card', `${spacingCard}px`)
    root.style.setProperty('--control-height', `${controlHeight}px`)
    root.style.setProperty('--table-row-pad', `${tableRowPad}px`)
  }, [settings.density, settings.densityPercent])

  const updateSettings = (partial: Partial<AppSettings>) => {
    console.log('[SettingsContext] Updating settings with:', partial)
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
      
      console.log('[SettingsContext] New settings state:', updated)
      return updated
    })
  }

  const resetSettings = () => {
    setSettings(defaultSettings)
  }

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, resetSettings }}>
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
