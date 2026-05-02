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
import { AuthProvider } from './context/AuthContext'
import { PwaUpdateBanner } from './components/PwaUpdateBanner'

// Initialize error tracking before mounting the app so early errors are captured.
initSentry()

// ---------------------------------------------------------------------------
// Service Worker Registration (issue #7 — handle registration errors)
// ---------------------------------------------------------------------------
// vite-plugin-pwa (registerType: 'prompt') registers the SW automatically in
// production. We also register it manually here so we can catch and log errors
// instead of silently failing. The SW handles caching; the app still works
// fully without it.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        console.info('[PWA] Service worker registered, scope:', reg.scope)
        // Poll for updates every 60 s while the tab is open.
        setInterval(() => reg.update().catch(() => { /* network may be offline */ }), 60_000)
      })
      .catch((err) => {
        // Registration failed (e.g. HTTPS not available, blocked by CSP, etc.).
        // App continues to work without offline support — log for diagnostics.
        console.warn('[PWA] Service worker registration failed:', err)
      })
  })
}

// Provider order matters:
//   QueryClientProvider → AuthProvider → SettingsProvider → I18nProvider → …
//
// SettingsProvider is nested inside AuthProvider so it can observe user
// login/logout events and reset settings to defaults on logout (fix #3).
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
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
      </AuthProvider>
    </QueryClientProvider>
    {/* PWA update prompt — rendered outside the provider tree so it survives
        context errors and is always visible (issue #1). */}
    <PwaUpdateBanner />
  </StrictMode>,
)
