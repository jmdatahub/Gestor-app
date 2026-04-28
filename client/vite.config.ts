import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Mi Panel Financiero',
        short_name: 'Finanzas',
        description: 'Controla tus ingresos, gastos e inversiones desde un solo lugar.',
        theme_color: '#4F46E5',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/app/dashboard',
        scope: '/',
        lang: 'es',
        icons: [
          {
            src: 'pwa-64x64.png',
            sizes: '64x64',
            type: 'image/png',
          },
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Don't cache the chunky exceljs bundle — it's lazy and rarely needed offline.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
        globIgnores: ['**/exceljs.min*.js'],
        // Network-first for API calls so users get fresh data when online.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 50, maxAgeSeconds: 5 * 60 },
            },
          },
          {
            // Supabase REST/Realtime — never cache these (data changes on the server).
            urlPattern: ({ url }) => url.hostname.endsWith('.supabase.co'),
            handler: 'NetworkOnly',
          },
        ],
      },
      devOptions: {
        // Disable in dev — vite-plugin-pwa SW can interfere with HMR.
        enabled: false,
      },
    }),
  ],
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
          // Tanstack Query is small but its updates are independent of app code.
          'query': ['@tanstack/react-query'],
        },
      },
    },
  },
})
