import { useSettings, type Theme, DESIGN_OPTIONS, type Design } from '../context/SettingsContext';
import { useI18n } from '../hooks/useI18n';
import { Sun, Moon, Monitor, X, Check, ChevronDown } from 'lucide-react';
import type { Density } from '../context/SettingsContext';
import { UiSelect } from './ui/UiSelect';
import { UiSegmented } from './ui/UiSegmented';
import { ApiTokensSettings } from './domain/ApiTokensSettings';
import { TelegramConnect } from './domain/TelegramConnect';
import { useState, useEffect, useRef } from 'react';

const FOCUSABLE_SELECTORS = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function SettingsPanel({ open, onClose }: Props) {
  const { settings, updateSettings } = useSettings();
  const { t } = useI18n();
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement as HTMLElement;

    const frameId = requestAnimationFrame(() => {
      if (!drawerRef.current) return;
      const first = drawerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)[0];
      if (first) first.focus();
      else drawerRef.current.focus();
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab' || !drawerRef.current) return;

      const focusable = Array.from(
        drawerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)
      );
      if (focusable.length === 0) { e.preventDefault(); return; }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="settings-overlay" role="dialog" aria-modal="true" aria-label={t('settings.title')}>
      <div className="settings-backdrop" onClick={onClose} />
      <div className="settings-drawer" ref={drawerRef} tabIndex={-1}>

        {/* Header */}
        <div className="settings-header">
          <div className="settings-title">{t('settings.title')}</div>
          <button className="icon-button" onClick={onClose} aria-label={t('settings.close')}>
            <X size={18} />
          </button>
        </div>

        <div className="settings-body">

          {/* ── Telegram ─────────────────────────────────────────── */}
          <div className="settings-section">
            <div className="settings-section-title">Telegram</div>
            <TelegramConnect />
          </div>

          {/* ── Apariencia (colapsable) ───────────────────────────── */}
          <div className={`settings-section settings-collapsible ${appearanceOpen ? 'is-open' : ''}`}>
            <button
              type="button"
              className="settings-collapsible-trigger"
              onClick={() => setAppearanceOpen(v => !v)}
              aria-expanded={appearanceOpen}
              aria-controls="settings-appearance-content"
            >
              <span className="settings-section-title">{t('settings.appearance')}</span>
              <span className="settings-collapsible-chevron" aria-hidden="true">
                <ChevronDown size={18} />
              </span>
            </button>

            <div
              id="settings-appearance-content"
              className="settings-collapsible-content"
              hidden={!appearanceOpen}
            >
                {/* Design picker */}
                <div className="settings-field">
                  <div className="settings-label">Estilo visual</div>
                  <div className="design-picker-grid">
                    {DESIGN_OPTIONS.map((opt) => {
                      const active = settings.design === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          className={`design-card${active ? ' design-card--active' : ''}`}
                          onClick={() => updateSettings({ design: opt.value as Design })}
                          aria-pressed={active}
                          title={opt.description}
                        >
                          <div className="design-card__preview" style={{ background: opt.previewColors.bg }} aria-hidden="true">
                            <div className="design-card__preview-card" style={{ background: opt.previewColors.surface, color: opt.previewColors.text }}>
                              <span className="design-card__preview-bar" style={{ background: opt.previewColors.accent }} />
                              <span className="design-card__preview-text" style={{ color: opt.previewColors.text, opacity: 0.7 }}>123</span>
                            </div>
                          </div>
                          <div className="design-card__body">
                            <div className="design-card__name">{opt.label}</div>
                            <div className="design-card__desc">{opt.description}</div>
                          </div>
                          {active
                            ? <span className="design-card__check" aria-hidden="true"><Check size={14} strokeWidth={3} /></span>
                            : <span className="design-card__check-empty" aria-hidden="true" />
                          }
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Theme */}
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
          </div>

          {/* ── Idioma & Formato ──────────────────────────────────── */}
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
                    { value: 'en', label: '🇬🇧 EN' },
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
                    { value: 'MM/dd/yyyy', label: '12/31' },
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
                  { value: 'dot', label: '1,234.56 €' },
                ]}
                block
              />
            </div>
          </div>

          {/* ── Notificaciones ────────────────────────────────────── */}
          <div className="settings-section">
            <div className="settings-section-title">{t('settings.alerts')}</div>
            <label className="check-row">
              <input
                type="checkbox"
                checked={settings.notifications.highSpending}
                onChange={(e) => updateSettings({ notifications: { ...settings.notifications, highSpending: e.target.checked } })}
              />
              <span>{t('settings.notifications.highSpending') || 'Gastos elevados'}</span>
            </label>
            <label className="check-row">
              <input
                type="checkbox"
                checked={settings.notifications.upcomingDebts}
                onChange={(e) => updateSettings({ notifications: { ...settings.notifications, upcomingDebts: e.target.checked } })}
              />
              <span>{t('settings.notifications.upcomingDebts') || 'Deudas próximas'}</span>
            </label>
          </div>

          {/* ── Tokens API ────────────────────────────────────────── */}
          <div className="settings-section">
            <div className="settings-section-title">Tokens API</div>
            <ApiTokensSettings />
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
