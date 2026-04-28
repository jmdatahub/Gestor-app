import { createContext, useContext, useMemo } from 'react';
import { useSettings } from '../context/SettingsContext';
import { translations } from './translations';
import { Language } from '../context/SettingsContext';

// Helper for human-readable fallback
function humanizeKey(key: string): string {
  // Take last part: 'common.date' -> 'date'
  const parts = key.split('.');
  const lastPart = parts[parts.length - 1];
  
  // 'accountSource' -> 'Account Source'
  return lastPart
    .replace(/([A-Z])/g, ' $1') // insert space before capital
    .replace(/^./, (str) => str.toUpperCase()) // capitalize first letter
    .trim();
}

type I18nContextValue = {
  t: (key: string, params?: Record<string, string | number>) => string;
  language: Language;
};

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useSettings();
  const language = settings.language;

  const value = useMemo(() => {
    return {
      language,
      t: (key: string, params?: Record<string, string | number>) => {
        const dict = translations[language] as Record<string, string>;
        let text = dict?.[key];

        // MISSING KEY LOGIC
        if (!text) {
          console.warn(`[I18n] Missing translation for key: "${key}" in language: "${language}"`);
          // Fallback to Spanish if in English (as it is likely more complete currently)
          if (language !== 'es' && translations['es'][key]) {
             text = translations['es'][key];
          } else {
             // Ultimate fallback: Humanize the key
             text = humanizeKey(key);
          }
        }

        if (params && text) {
          Object.entries(params).forEach(([paramKey, value]) => {
            text = text!.replace(new RegExp(`{${paramKey}}`, 'g'), String(value));
          });
        }
        
        return text || key; 
      }
    };
  }, [language]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return ctx;
}
