import { useState } from 'react'
import { X, Moon, Sun, Monitor, Globe, LayoutGrid, Calendar, Hash, Bell } from 'lucide-react'
import { useSettings, Theme, Language, Density, DateFormat, DecimalSeparator } from '../context/SettingsContext'
import { UiSegmented } from './ui/UiSegmented'
import { UiField } from './ui/UiField'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { settings, updateSettings, resetSettings } = useSettings()
  const [activeTab, setActiveTab] = useState('general')

  if (!isOpen) return null

  const themeOptions: { value: Theme; label: string; icon: typeof Sun }[] = [
    { value: 'light', label: 'Claro', icon: Sun },
    { value: 'dark', label: 'Oscuro', icon: Moon },
    { value: 'auto', label: 'Sistema', icon: Monitor },
  ]

  const languageOptions: { value: Language; label: string }[] = [
    { value: 'es', label: 'Español' },
    { value: 'en', label: 'English' },
  ]

  const densityOptions: { value: Density; label: string }[] = [
    { value: 'compact', label: 'Compacto' },
    { value: 'normal', label: 'Normal' },
    { value: 'large', label: 'Amplio' },
  ]

  const dateFormatOptions = [
    { value: 'dd/MM/yyyy', label: 'DD/MM/AAAA (31/12/2025)' },
    { value: 'MM/dd/yyyy', label: 'MM/DD/AAAA (12/31/2025)' },
  ]

  const decimalOptions = [
    { value: 'comma', label: 'Coma (1.234,56)' },
    { value: 'dot', label: 'Punto (1,234.56)' },
  ]

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal" 
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '560px', width: '100%' }}
      >
        {/* Header */}
        <div className="modal-header">
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <LayoutGrid size={20} />
            Ajustes
          </span>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-100 p-4">
            <UiSegmented
                value={activeTab}
                onChange={setActiveTab}
                options={[
                    { value: 'general', label: 'General', icon: <LayoutGrid size={16}/> },
                    { value: 'notifications', label: 'Notificaciones', icon: <Bell size={16}/> }
                ]}
            />
        </div>

        {/* Content */}
        <div className="modal-body">
          {activeTab === 'general' && (
            <div className="d-flex flex-col gap-6">
              {/* Theme */}
              <div className="form-group">
                <label className="label d-flex items-center gap-2">
                  <Sun size={16} />
                  Tema
                </label>
                <UiSegmented
                  value={settings.theme}
                  onChange={(val) => updateSettings({ theme: val as Theme })}
                  options={themeOptions.map(opt => ({
                    value: opt.value,
                    label: opt.label,
                    icon: <opt.icon size={16} />
                  }))}
                  block
                />
              </div>

              {/* Language */}
              <div className="form-group">
                <label className="label d-flex items-center gap-2">
                  <Globe size={16} />
                  Idioma
                </label>
                <UiSegmented
                  value={settings.language}
                  onChange={(val) => updateSettings({ language: val as Language })}
                  options={languageOptions}
                  block
                />
              </div>

              {/* Density */}
              <div className="form-group">
                <label className="label d-flex items-center gap-2">
                  <LayoutGrid size={16} />
                  Densidad
                </label>
                <UiSegmented
                  value={settings.density}
                  onChange={(val) => updateSettings({ density: val as Density })}
                  options={densityOptions}
                  block
                />
              </div>

              {/* Date Format */}
              <UiField label={
                  <span className="d-flex items-center gap-2">
                      <Calendar size={16} />
                      Formato de fecha
                  </span>
              }>
                <UiSegmented
                  value={settings.dateFormat}
                  onChange={(val) => updateSettings({ dateFormat: val as DateFormat })}
                  options={dateFormatOptions}
                  block
                />
              </UiField>

              {/* Decimal Separator */}
               <UiField label={
                  <span className="d-flex items-center gap-2">
                      <Hash size={16} />
                      Separador decimal
                  </span>
              }>
                <UiSegmented
                  value={settings.decimalSeparator}
                  onChange={(val) => updateSettings({ decimalSeparator: val as DecimalSeparator })}
                  options={decimalOptions}
                  block
                />
              </UiField>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="d-flex flex-col gap-4">
              <p className="text-sm text-secondary mb-2">
                Configura qué alertas quieres recibir
              </p>
              
              {/* Notification toggles */}
              {Object.entries({
                highSpending: 'Gasto elevado',
                recurring: 'Movimientos recurrentes pendientes',
                savingsGoals: 'Progreso de metas de ahorro',
                upcomingDebts: 'Deudas próximas a vencer',
                investments: 'Cambios en inversiones',
              }).map(([key, label]) => (
                <label key={key} className="d-flex justify-between items-center py-3 border-b border-gray-100 cursor-pointer">
                  <span className="text-sm font-medium">{label}</span>
                  <div className="relative">
                     <input 
                        type="checkbox"
                        className="sr-only"
                        checked={settings.notifications[key as keyof typeof settings.notifications]}
                        onChange={() => updateSettings({
                            notifications: {
                                ...settings.notifications,
                                [key]: !settings.notifications[key as keyof typeof settings.notifications]
                            }
                        })}
                     />
                     <div className={`w-11 h-6 rounded-full transition-colors ${
                         settings.notifications[key as keyof typeof settings.notifications] 
                         ? 'bg-primary' 
                         : 'bg-gray-300'
                     }`}></div>
                     <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                         settings.notifications[key as keyof typeof settings.notifications] 
                         ? 'translate-x-6' 
                         : 'translate-x-1'
                     }`}></div>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer d-flex">
          <button 
            className="btn btn-ghost" 
            onClick={resetSettings}
            style={{ marginRight: 'auto' }}
          >
            Restaurar predeterminados
          </button>
          <button className="btn btn-primary" onClick={onClose}>
            Guardar
          </button>
        </div>
      </div>
    </div>
  )
}
