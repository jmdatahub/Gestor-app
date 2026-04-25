import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'
import { queryClient } from './lib/queryClient'
import { initSentry } from './lib/sentry'
import { SettingsProvider } from './context/SettingsContext'
import { I18nProvider } from './i18n/I18nContext'
import { ToastProvider } from './components/Toast'
import { OfflineProvider } from './context/OfflineContext'
import { WorkspaceProvider } from './context/WorkspaceContext'

// Initialize error tracking before mounting the app so early errors are captured.
initSentry()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <SettingsProvider>
        <I18nProvider>
        <ToastProvider>
          <OfflineProvider>
            <WorkspaceProvider>
              <App />
            </WorkspaceProvider>
          </OfflineProvider>
        </ToastProvider>
      </I18nProvider>
    </SettingsProvider>
    </QueryClientProvider>
  </StrictMode>,
)
