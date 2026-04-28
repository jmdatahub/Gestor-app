import * as Sentry from '@sentry/react'

/**
 * Initialize Sentry for production error tracking.
 *
 * No-ops gracefully when `VITE_SENTRY_DSN` is not set, so local dev / preview
 * builds without a configured Sentry project don't break.
 *
 * Setup:
 *   1. Create a project at https://sentry.io
 *   2. Add `VITE_SENTRY_DSN=https://...` to your Vercel env vars
 *   3. Optionally set `VITE_SENTRY_ENVIRONMENT=production` (defaults to import.meta.env.MODE)
 */
export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn) {
    if (import.meta.env.PROD) {
      // In prod, missing DSN is a configuration mistake — log loudly.
      console.warn('[sentry] VITE_SENTRY_DSN is not set. Errors will not be reported.')
    }
    return
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE,
    // Capture browser errors and unhandled promise rejections automatically.
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    // Conservative sampling for cost control. Tweak via env if needed.
    tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    // Only enable in production by default — local errors are noisy and not actionable.
    enabled: import.meta.env.PROD,
    // Strip URLs that contain Supabase keys / tokens before sending.
    beforeSend(event) {
      if (event.request?.url) {
        event.request.url = event.request.url.replace(/([?&])(apikey|access_token|token)=[^&]*/gi, '$1$2=REDACTED')
      }
      return event
    },
  })
}

// Re-export the React error boundary helper so the app's ErrorBoundary can
// optionally forward errors to Sentry once initialized.
export const captureException = Sentry.captureException
