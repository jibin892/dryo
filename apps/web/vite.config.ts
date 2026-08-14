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
        // Precache immutable, content-hashed assets only — NOT index.html.
        // A cached index.html is what leaves an installed PWA pointing at a
        // purged JS bundle after a deploy (→ blank screen on refresh).
        globPatterns: ['**/*.{js,css,ico,png,svg,woff2}'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        // Disable the default cache-first index.html navigation route — it's the
        // stale shell. Our NetworkFirst navigate handler below serves fresh HTML.
        navigateFallback: null,
        // Navigations go network-first: always fetch the freshest HTML (whose
        // asset hashes match the current build), falling back to the last good
        // cached copy only when offline.
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'dryo-html',
              networkTimeoutSeconds: 3,
              cacheableResponse: { statuses: [200] },
              expiration: { maxEntries: 8 },
            },
          },
        ],
      },
    }),
  ],
})
