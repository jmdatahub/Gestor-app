import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { SettingsProvider } from './context/SettingsContext'
import { I18nProvider } from './i18n/I18nContext'
import { ToastProvider } from './components/Toast'
import { OfflineProvider } from './context/OfflineContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SettingsProvider>
      <I18nProvider>
        <ToastProvider>
          <OfflineProvider>
            <App />
          </OfflineProvider>
        </ToastProvider>
      </I18nProvider>
    </SettingsProvider>
  </StrictMode>,
)
