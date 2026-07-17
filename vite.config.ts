import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackRouter } from '@tanstack/router-plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
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
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff,woff2}'],
        cleanupOutdatedCaches: true,
        navigateFallback: '/index.html',
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
})

export default config
