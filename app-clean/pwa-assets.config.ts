import {
  defineConfig,
  minimal2023Preset,
} from '@vite-pwa/assets-generator/config'

export default defineConfig({
  // Generate from the existing favicon.svg.
  // Outputs: pwa-64x64.png, pwa-192x192.png, pwa-512x512.png, maskable-icon-512x512.png, apple-touch-icon-180x180.png, favicon.ico
  preset: minimal2023Preset,
  images: ['public/favicon.svg'],
})
