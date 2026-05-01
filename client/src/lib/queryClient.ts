import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes
      retry: (failureCount, error) => {
        // Never retry on 401 — the token is invalid, redirect happens via apiClient.
        const status = (error as { status?: number })?.status
        if (status === 401) return false
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
