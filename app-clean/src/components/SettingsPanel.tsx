import { useSettings, type Theme } from '../context/SettingsContext';
import { useI18n } from '../hooks/useI18n';
import { Sun, Moon, Monitor, X } from 'lucide-react';
import type { Density, NotificationSettings } from '../context/SettingsContext';
import { UiSelect } from './ui/UiSelect';
import { UiSegmented } from './ui/UiSegmented';
import { PaymentMethodsSettings } from './domain/PaymentMethodsSettings';
import { ApiTokensSettings } from './domain/ApiTokensSettings';
import { ApiDocsPanel } from './domain/ApiDocsPanel';

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function SettingsPanel({ open, onClose }: Props) {
  const { settings, updateSettings } = useSettings();
  const { t } = useI18n();

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

            {/* Density */}
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

          {/* Language Section */}
          <div className="settings-section">
            <div className="settings-section-title">{t('settings.language')}</div>
            <div className="settings-field">
              <UiSelect
                value={settings.language}
                onChange={(val) => updateSettings({ language: val as 'es' | 'en' })}
                options={[
                  { value: 'es', label: '🇪🇸 Español' },
                  { value: 'en', label: '🇬🇧 English' }
                ]}
              />
            </div>
          </div>

          {/* Format Section */}
          <div className="settings-section">
            <div className="settings-section-title">{t('settings.format')}</div>

            <div className="settings-field">
              <div className="settings-label">{t('settings.dateFormat')}</div>
              <UiSegmented
                  value={settings.dateFormat}
                  onChange={(val) => updateSettings({ dateFormat: val as any })}
                  options={[
                      { value: 'dd/MM/yyyy', label: '31/12/2025' },
                      { value: 'MM/dd/yyyy', label: '12/31/2025' }
                  ]}
                  block
              />
            </div>

            {/* Separador Decimal */}
            <div className="settings-field">
              <div className="settings-label">{t('settings.decimalSeparator')}</div>
              <UiSegmented
                  value={settings.decimalSeparator}
                  onChange={(val) => updateSettings({ decimalSeparator: val as any })}
                  options={[
                      { value: 'comma', label: '1.234,56' },
                      { value: 'dot', label: '1,234.56' }
                  ]}
                  block
              />
            </div>
          </div>

          {/* Payment Methods Section */}
          <div className="settings-section">
            <div className="settings-section-title">Métodos de Pago</div>
             <PaymentMethodsSettings />
          </div>

          {/* Alerts Section (Updated to Notifications) */}
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

          {/* API & Developers Section */}
          <div className="settings-section">
            <div className="settings-section-title">API & Desarrolladores</div>
             <ApiTokensSettings />
             <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-700">
               <ApiDocsPanel />
             </div>
          </div>
        </div>

        <div className="settings-footer">
          <button className="btn btn-secondary" onClick={onClose} type="button">
            {t('settings.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
