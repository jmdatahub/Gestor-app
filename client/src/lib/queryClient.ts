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

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 2 minutes default — a reasonable middle ground for financial data.
      staleTime: 1000 * 60 * 2,
      // Keep inactive cache for 15 minutes so navigating back is instant.
      gcTime: 1000 * 60 * 15,
      retry: (failureCount, error) => {
        // Never retry on 401 — the token is invalid, redirect happens via apiClient.
        const status = (error as { status?: number })?.status
        if (status === 401) return false
        // One retry for transient network errors.
        return failureCount < 1
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: (failureCount, error) => {
        const status = (error as { status?: number })?.status
        if (status === 401) return false
        return failureCount < 1
      },
    },
  },
})
