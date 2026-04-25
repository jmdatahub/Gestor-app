import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5180,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // React core stays in its own chunk so it's cached aggressively across deploys.
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // Recharts is heavy and only used on chart-heavy pages — keep it isolated.
          'charts': ['recharts'],
          // Lucide ships hundreds of icons; isolating it lets the rest of the app re-deploy without invalidating it.
          'icons': ['lucide-react'],
          // Supabase client + auth helpers — used everywhere, but isolating it keeps the app shell smaller.
          'supabase': ['@supabase/supabase-js'],
          // Tanstack Query is small but its updates are independent of app code.
          'query': ['@tanstack/react-query'],
        },
      },
    },
  },
})
