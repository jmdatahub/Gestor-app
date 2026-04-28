// Re-export from new structure for backward compatibility
export { translations } from './i18n/translations';
export { useI18n } from './i18n/I18nContext';

// Simple t function for non-hook usage (legacy)
import { translations } from './i18n/translations';
import type { Language } from './context/SettingsContext';

export function t(key: string, language: Language, params?: Record<string, string | number>): string {
  const dict = translations[language] as Record<string, string>;
  let text = dict?.[key];
  
  if (!text) {
     // Humanize fallback for legacy calls too
     const parts = key.split('.');
     const lastPart = parts[parts.length - 1];
     text = lastPart.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase()).trim();
  }

  if (params && text) {
    Object.entries(params).forEach(([paramKey, value]) => {
      text = text!.replace(new RegExp(`{${paramKey}}`, 'g'), String(value));
    });
  }
  
  return text;
}
