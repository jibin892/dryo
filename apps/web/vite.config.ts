import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/dryo-180.png', 'icons/dryo-192.png', 'icons/dryo-512.png'],
      manifest: {
        name: 'Dryo — Cardamom Curing House',
        short_name: 'Dryo',
        description: 'Batch, chamber and inventory management for cardamom dryer & curing houses.',
        theme_color: '#FEF9EF',
        background_color: '#FEF9EF',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icons/dryo-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/dryo-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/dryo-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
})
