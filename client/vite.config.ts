import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { compression } from 'vite-plugin-compression2'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Emit gzip and brotli side-car files (.gz / .br) alongside the build output.
    // The web server (nginx / Caddy) serves them automatically when the client
    // supports the encoding, reducing transfer sizes by ~70-80%.
    compression({ algorithms: ['gzip'], exclude: [/\.(br)$/, /\.(gz)$/] }),
    compression({ algorithms: ['brotliCompress'], exclude: [/\.(br)$/, /\.(gz)$/] }),
    VitePWA({
      // 'prompt' keeps the new SW in waiting state so we can show a
      // "Nueva versión disponible" banner before reloading (issue #1).
      registerType: 'prompt',
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
        // Network-first for GET API calls so users get fresh data when online
        // but fall back to the cache when offline (issue #3).
        // Only GET requests are cached — POST/PATCH/DELETE mutations are never
        // cached; the offline queue in apiClient.ts handles those instead.
        runtimeCaching: [
          {
            // API responses are tenant-scoped and shape-versioned; stale cache
            // hits across deploys or user switches cause "no se pudo cargar X"
            // errors. The offline mutation queue handles writes; reads should
            // always hit the network and fail fast if offline.
            urlPattern: ({ url, request }) =>
              url.pathname.startsWith('/api/') && request.method === 'GET',
            handler: 'NetworkOnly',
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
    proxy: {
      '/api': {
        // Gestor backend = 3002 (CRM ocupa 3001 por convención de equipo).
        // Puede sobreescribirse con VITE_GESTOR_API_PORT si hace falta.
        target: `http://localhost:${process.env.VITE_GESTOR_API_PORT || '3002'}`,
        changeOrigin: true,
      },
    },
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
