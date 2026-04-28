import { useSettings, type Theme } from '../context/SettingsContext';
import { useI18n } from '../hooks/useI18n';
import { Sun, Moon, Monitor, X, HelpCircle } from 'lucide-react';
import type { Density } from '../context/SettingsContext';
import { UiSelect } from './ui/UiSelect';
import { UiSegmented } from './ui/UiSegmented';
import { ApiTokensSettings } from './domain/ApiTokensSettings';
import { UiModal, UiModalHeader, UiModalBody, UiModalFooter } from './ui/UiModal';
import { useState } from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function SettingsPanel({ open, onClose }: Props) {
  const { settings, updateSettings } = useSettings();
  const { t } = useI18n();
  const [showApiHelp, setShowApiHelp] = useState(false);

  if (!open) return null;

  return (
    <div className="settings-overlay" role="dialog" aria-modal="true" aria-label={t('settings.title')}>
      <div className="settings-backdrop" onClick={onClose} />
      <div className="settings-drawer">
        <div className="settings-header">
          <div className="settings-title">{t('settings.title')}</div>
          <button className="icon-button" onClick={onClose} aria-label={t('settings.close')}>
            <X size={18} />
          </button>
        </div>

        <div className="settings-body">
          {/* Appearance Section */}
          <div className="settings-section">
            <div className="settings-section-title">{t('settings.appearance')}</div>

            <div className="settings-field">
              <div className="settings-label">{t('settings.theme')}</div>
              <UiSegmented
                value={settings.theme}
                onChange={(val) => updateSettings({ theme: val as Theme })}
                options={[
                  { value: 'light', label: t('settings.theme.light'), icon: <Sun size={16} /> },
                  { value: 'dark', label: t('settings.theme.dark'), icon: <Moon size={16} /> },
                  { value: 'auto', label: t('settings.theme.auto'), icon: <Monitor size={16} /> },
                ]}
                block
              />
            </div>

            <div className="settings-field">
              <div className="settings-label">{t('settings.density')}</div>
              <UiSegmented
                value={settings.density}
                onChange={(val) => updateSettings({ density: val as Density })}
                options={[
                  { value: 'compact', label: t('settings.density.compact') },
                  { value: 'normal', label: t('settings.density.normal') },
                  { value: 'large', label: t('settings.density.spacious') },
                ]}
                block
              />
            </div>
          </div>

          {/* Language & Format Section */}
          <div className="settings-section">
            <div className="settings-section-title">{t('settings.language')} y Formato</div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="settings-label text-xs mb-1">{t('settings.language')}</div>
                <UiSelect
                  value={settings.language}
                  onChange={(val) => updateSettings({ language: val as 'es' | 'en' })}
                  options={[
                    { value: 'es', label: '🇪🇸 ES' },
                    { value: 'en', label: '🇬🇧 EN' }
                  ]}
                />
              </div>
              <div>
                <div className="settings-label text-xs mb-1">{t('settings.dateFormat')}</div>
                <UiSelect
                  value={settings.dateFormat}
                  onChange={(val) => updateSettings({ dateFormat: val as any })}
                  options={[
                    { value: 'dd/MM/yyyy', label: '31/12' },
                    { value: 'MM/dd/yyyy', label: '12/31' }
                  ]}
                />
              </div>
            </div>
            
            <div className="mt-3">
              <div className="settings-label text-xs mb-1">{t('settings.decimalSeparator')}</div>
              <UiSegmented
                  value={settings.decimalSeparator}
                  onChange={(val) => updateSettings({ decimalSeparator: val as any })}
                  options={[
                      { value: 'comma', label: '1.234,56 €' },
                      { value: 'dot', label: '1,234.56 €' }
                  ]}
                  block
              />
            </div>
          </div>

          {/* Notifications Section */}
          <div className="settings-section">
            <div className="settings-section-title">{t('settings.alerts')}</div>

            <label className="check-row">
              <input
                type="checkbox"
                checked={settings.notifications.highSpending}
                onChange={(e) =>
                  updateSettings({ notifications: { ...settings.notifications, highSpending: e.target.checked } })
                }
              />
              <span>{t('settings.notifications.highSpending') || 'Gastos elevados'}</span>
            </label>

            <label className="check-row">
              <input
                type="checkbox"
                checked={settings.notifications.upcomingDebts}
                onChange={(e) =>
                  updateSettings({ notifications: { ...settings.notifications, upcomingDebts: e.target.checked } })
                }
              />
              <span>{t('settings.notifications.upcomingDebts') || 'Deudas próximas'}</span>
            </label>
          </div>

          {/* API Section */}
          <div className="settings-section">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div className="settings-section-title" style={{ marginBottom: 0 }}>Tokens API</div>
              <button 
                onClick={() => setShowApiHelp(true)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  padding: '4px 8px',
                  borderRadius: 'var(--radius-sm)'
                }}
              >
                Más info
              </button>
            </div>
            <ApiTokensSettings />
          </div>
        </div>

        <div className="settings-footer">
          <button className="btn btn-secondary" onClick={onClose} type="button">
            {t('settings.close')}
          </button>
        </div>
      </div>

      {/* API Help Modal */}
      <UiModal isOpen={showApiHelp} onClose={() => setShowApiHelp(false)}>
        <UiModalHeader>Documentación API</UiModalHeader>
        <UiModalBody>
          <div className="space-y-4 text-sm">
            <div>
              <h4 className="font-semibold mb-1">¿Qué es esto?</h4>
              <p className="text-gray-600 dark:text-gray-400">
                Los tokens API te permiten conectar programas externos (scripts de Python, Excel con macros, etc.) 
                para importar o exportar datos automáticamente.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-1">¿Cómo funciona?</h4>
              <ol className="text-gray-600 dark:text-gray-400 list-decimal list-inside space-y-1">
                <li>Genera un token con el botón "+ Nuevo token"</li>
                <li>Copia el token (solo se muestra una vez)</li>
                <li>Úsalo en tus scripts para autenticarte</li>
              </ol>
            </div>

            <div>
              <h4 className="font-semibold mb-1">Endpoints disponibles</h4>
              <div className="space-y-2 font-mono text-xs">
                <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded">
                  <span className="text-green-600">GET</span> /api/v1/movements
                  <div className="text-gray-500 mt-1">Obtener lista de movimientos</div>
                </div>
                <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded">
                  <span className="text-blue-600">POST</span> /api/v1/movements
                  <div className="text-gray-500 mt-1">Crear movimientos (individual o masivo)</div>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-1">Ejemplo de uso</h4>
              <pre className="p-2 bg-gray-900 text-gray-100 rounded text-xs overflow-x-auto">
{`curl -H "Authorization: Bearer TU_TOKEN" \\
  https://tu-app.vercel.app/api/v1/movements`}
              </pre>
            </div>

            <a 
              href="/api/v1" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{
                display: 'block',
                padding: '8px 12px',
                background: 'var(--primary-soft)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.8rem',
                color: 'var(--primary)',
                textAlign: 'center',
                textDecoration: 'none'
              }}
            >
              📄 Ver documentación completa
            </a>
          </div>
        </UiModalBody>
        <UiModalFooter>
          <button className="btn btn-primary" onClick={() => setShowApiHelp(false)}>Entendido</button>
        </UiModalFooter>
      </UiModal>
    </div>
  );
}
