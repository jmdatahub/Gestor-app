import { QueryClient } from '@tanstack/react-query'

// ---------------------------------------------------------------------------
// staleTime / gcTime strategy
// ---------------------------------------------------------------------------
// staleTime controls when a cached result is considered "stale" and eligible
// for a background refetch on the next mount/focus.
//
// gcTime (formerly cacheTime) controls how long an *inactive* (unmounted)
// query is kept in memory before being garbage-collected.
//
// Rule of thumb used here:
//   • Reference data that rarely changes (categories, payment methods,
//     organisations) → long staleTime (10 min) — re-uses the cache across
//     navigation without any refetch noise.
//   • Core financial data (movements, accounts, debts, savings, investments)
//     → medium staleTime (2 min) — fresh enough for typical usage without
//     hammering the API every time the user switches pages.
//   • Real-time-ish data (dashboard summary, alerts) → short staleTime
//     (30 s) — tolerable lag while still avoiding per-render fetches.
//
// refetchOnWindowFocus is disabled globally. Enabling it would cause every
// tab-switch to trigger background fetches which is noisy in a finance app
// where data changes rarely.
// ---------------------------------------------------------------------------

// Errors thrown by apiClient carry a numeric `status` field. 5xx (and the
// "no status" case — pure network failure) are worth retrying; client errors
// (4xx) are not — they're our bug or the user's, retrying won't help.
function shouldRetry(failureCount: number, error: unknown): boolean {
  const status = (error as { status?: number })?.status
  if (status === 401) return false               // auth — handled by redirect
  if (status === 403 || status === 404) return false
  if (status === 422 || status === 400) return false
  // 503 (service unavailable / DB blip) gets up to 2 retries; other errors 1.
  const max = status === 503 || status === undefined ? 2 : 1
  return failureCount < max
}

// Exponential backoff with jitter: 400 ms, 800 ms, 1.6 s. Caps at 5 s.
function retryDelay(attempt: number): number {
  const base = 400 * 2 ** attempt
  const jitter = Math.random() * 200
  return Math.min(base + jitter, 5000)
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 2 minutes default — a reasonable middle ground for financial data.
      staleTime: 1000 * 60 * 2,
      // Keep inactive cache for 15 minutes so navigating back is instant.
      gcTime: 1000 * 60 * 15,
      retry: shouldRetry,
      retryDelay,
      refetchOnWindowFocus: false,
    },
    mutations: {
      // Mutations are not idempotent in general — retry only on 503/network
      // errors (where the request likely never reached the server) and at
      // most once, to avoid double-submits on flaky connections.
      retry: (failureCount, error) => {
        const status = (error as { status?: number })?.status
        if (status === 503 || status === undefined) return failureCount < 1
        return false
      },
      retryDelay,
    },
  },
})
