import { useState } from 'react'
import { Moon, Sun, Monitor, Globe, LayoutGrid, Calendar, Hash, Bell, Layers, LogOut, Volume2, VolumeX } from 'lucide-react'
import { UiCard, UiCardBody } from '../../components/ui/UiCard'
import { UiSelect } from '../../components/ui/UiSelect'
import { UiSegmented } from '../../components/ui/UiSegmented'
import { UiField } from '../../components/ui/UiField'
import { useSettings, type Theme, type Language, type Density, type DateFormat, type DecimalSeparator, type NotificationSettings } from '../../context/SettingsContext'

export default function SettingsPage() {
  const { settings, updateSettings } = useSettings()
  const [activeTab, setActiveTab] = useState<'general' | 'notifications'>('general')

  const themeOptions = [
    { value: 'light', label: 'Claro', icon: <Sun size={16} /> },
    { value: 'dark', label: 'Oscuro', icon: <Moon size={16} /> },
    { value: 'auto', label: 'Sistema', icon: <Monitor size={16} /> },
  ]

  const languageOptions = [
    { value: 'es', label: 'Español' },
    { value: 'en', label: 'English' },
  ]

  const densityOptions = [
    { value: 'compact', label: 'Compacto' },
    { value: 'normal', label: 'Normal' },
    { value: 'large', label: 'Amplio' },
  ]

  const dateFormatOptions = [
    { value: 'dd/MM/yyyy', label: '31/12/2025 (DD/MM/AAAA)' },
    { value: 'MM/dd/yyyy', label: '12/31/2025 (MM/DD/AAAA)' },
  ]

  const decimalOptions = [
    { value: 'comma', label: '1.234,56 (Europa/Latam)' },
    { value: 'dot', label: '1,234.56 (USA/UK)' },
  ]

  const resetSettings = () => {
    if (confirm('¿Restaurar todos los ajustes a los valores predeterminados?')) {
        localStorage.removeItem('app_settings');
        window.location.reload();
    }
  }

  const notificationOptions: Record<keyof NotificationSettings, string> = {
    highSpending: 'Gastos elevados',
    recurring: 'Pagos recurrentes',
    savingsGoals: 'Metas de ahorro',
    upcomingDebts: 'Deudas próximas a vencer',
    investments: 'Cambios en inversiones',
  }

  return (
    <div className="page-container max-w-4xl mx-auto">
      {/* Header */}
      <div className="page-header mb-6">
        <div>
          <h1 className="page-title">Ajustes</h1>
          <p className="page-subtitle">Personaliza tu experiencia</p>
        </div>
      </div>

       <UiCard>
        {/* Tabs using UiSegmented */}
        <div className="p-4 border-b border-border">
             <UiSegmented
                value={activeTab}
                onChange={(val) => setActiveTab(val as 'general' | 'notifications')}
                options={[
                    { value: 'general', label: 'General', icon: <LayoutGrid size={16} /> },
                    { value: 'notifications', label: 'Notificaciones', icon: <Bell size={16} /> }
                ]}
                block
             />
        </div>

        {/* Content */}
        <UiCardBody>
          {activeTab === 'general' && (
            <div className="flex flex-col gap-8">
              
              {/* Roll-up Settings */}
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border">
                    <div className="flex items-center gap-3">
                         <div className="p-2 bg-primary/10 rounded-md text-primary">
                            <Layers size={20} />
                         </div>
                         <div>
                            <span className="block font-medium text-foreground">Agrupar cuentas padre</span>
                            <span className="block text-xs text-muted-foreground mt-0.5">
                                En resúmenes y exportaciones, sumar subcuentas en la cuenta principal.
                            </span>
                         </div>
                    </div>
                    
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={settings.rollupAccountsByParent}
                        onChange={() => updateSettings({ rollupAccountsByParent: !settings.rollupAccountsByParent })}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/40 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                    </label>
                </div>
              </div>
              
              {/* Sound Settings */}
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border">
                    <div className="flex items-center gap-3">
                         <div className="p-2 bg-primary/10 rounded-md text-primary">
                            {settings.soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
                         </div>
                         <div>
                            <span className="block font-medium text-foreground">Sonidos de la app</span>
                            <span className="block text-xs text-muted-foreground mt-0.5">
                                Reproduce sonidos sutiles en notificaciones y acciones.
                            </span>
                         </div>
                    </div>
                    
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={settings.soundEnabled}
                        onChange={() => updateSettings({ soundEnabled: !settings.soundEnabled })}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/40 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                    </label>
                </div>
              </div>

               <div className="h-px bg-border my-2" />

              {/* Theme */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Sun size={16} />
                  Tema
                </label>
                <UiSegmented
                  value={settings.theme}
                  onChange={(val) => updateSettings({ theme: val as Theme })}
                  options={themeOptions}
                />
              </div>

              {/* Language */}
              <div className="space-y-3">
                <UiField 
                    label={
                        <span className="flex items-center gap-2">
                            <Globe size={16} /> Idioma
                        </span>
                    }
                >
                    <UiSelect
                        value={settings.language}
                        onChange={(val) => updateSettings({ language: val as Language })}
                        options={languageOptions}
                    />
                </UiField>
              </div>

              {/* Density */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <LayoutGrid size={16} />
                  Densidad
                </label>
                 <UiSegmented
                  value={settings.density}
                  onChange={(val) => updateSettings({ density: val as Density })}
                  options={densityOptions}
                />
              </div>

              {/* Formatters */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Calendar size={16} /> Formato de fecha
                  </label>
                  <UiSegmented
                    value={settings.dateFormat}
                    onChange={(val) => updateSettings({ dateFormat: val as DateFormat })}
                    options={dateFormatOptions}
                    block
                  />
                </div>

                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Hash size={16} /> Separador decimal
                  </label>
                  <UiSegmented
                    value={settings.decimalSeparator}
                    onChange={(val) => updateSettings({ decimalSeparator: val as DecimalSeparator })}
                    options={decimalOptions}
                    block
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-secondary mb-2">
                Configura qué alertas quieres recibir
              </p>
              
              {/* Notification toggles */}
              {(Object.entries(notificationOptions) as [keyof NotificationSettings, string][]).map(([key, label]) => (
                 <div key={key} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                  <span className="text-sm font-medium text-foreground">{label}</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={settings.notifications[key]}
                        onChange={(e) => updateSettings({
                          notifications: {
                            ...settings.notifications,
                            [key]: e.target.checked
                          }
                        })}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/40 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                    </label>
                </div>
              ))}
            </div>
          )}
        </UiCardBody>

        {/* Footer */}
        <div className="p-6 border-t border-border flex justify-end">
          <button 
            className="btn btn-ghost text-danger hover:bg-danger/10" 
            onClick={resetSettings}
          >
            <LogOut size={16} className="mr-2" />
            Restaurar predeterminados
          </button>
        </div>
      </UiCard>
    </div>
  )
}
