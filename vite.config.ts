import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackRouter } from '@tanstack/router-plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

/** Heavy jspdf ecosystem chunks — load on demand, not in the SW precache. */
const PDF_PRECACHE_SKIP =
  /(?:^|\/)(?:guardianCodesPdf|html2canvas|index\.es|purify\.es)-[^/]+\.js$/

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  build: {
    rolldownOptions: {
      output: {
        // Manual groups can reorder modules; keep import order for Convex/auth init.
        strictExecutionOrder: true,
        codeSplitting: {
          groups: [
            {
              name: 'react-vendor',
              test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/,
            },
            {
              name: 'convex-vendor',
              test: /node_modules[\\/](convex|@convex-dev)[\\/]/,
            },
            {
              name: 'router-vendor',
              test: /node_modules[\\/]@tanstack[\\/]/,
            },
            {
              name: 'i18n-vendor',
              test: /node_modules[\\/](i18next|react-i18next)[\\/]/,
            },
          ],
        },
      },
    },
  },
  plugins: [
    devtools(),
    tailwindcss(),
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    viteReact(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: [
        'brand/icon-removebg.webp',
        'brand/icon-removebg-xs.webp',
        'brand/icon-removebg.svg',
      ],
      manifest: {
        name: 'ClassClarus',
        short_name: 'ClassClarus',
        description: 'ClassClarus classroom management app.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#c81e5b',
        background_color: '#ffffff',
        icons: [
          {
            src: '/brand/icon-removebg-small.webp',
            sizes: '192x192',
            type: 'image/webp',
            purpose: 'any',
          },
          {
            src: '/brand/icon-removebg.webp',
            sizes: '512x512',
            type: 'image/webp',
            purpose: 'any',
          },
          {
            src: '/brand/icon-removebg.webp',
            sizes: '512x512',
            type: 'image/webp',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: [
          '**/*.{js,css,html,ico,png,svg,webp,woff,woff2,json}',
        ],
        cleanupOutdatedCaches: true,
        navigateFallback: '/index.html',
        manifestTransforms: [
          async (entries) => ({
            manifest: entries.filter(
              (entry) => !PDF_PRECACHE_SKIP.test(entry.url),
            ),
            warnings: [],
          }),
        ],
        runtimeCaching: [
          {
            urlPattern: PDF_PRECACHE_SKIP,
            handler: 'CacheFirst',
            options: {
              cacheName: 'pdf-chunks',
              expiration: {
                maxEntries: 8,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
})

export default config
