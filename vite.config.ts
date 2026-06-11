import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
      includeAssets: ['icons/*.png', 'icons/*.svg'],
      manifest: {
        name: 'Ashiyaan',
        short_name: 'Ashiyaan',
        description: 'Smart hostel & PG management platform',
        theme_color: '#1A3D3D',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/dashboard',
        scope: '/',
        icons: [
          { src: 'icons/pwa-64x64.png',          sizes: '64x64',   type: 'image/png' },
          { src: 'icons/pwa-192x192.png',         sizes: '192x192', type: 'image/png' },
          { src: 'icons/pwa-512x512.png',         sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Gate Pass', short_name: 'Gate', description: 'Generate your gate pass', url: '/gate-pass', icons: [{ src: 'icons/pwa-192x192.png', sizes: '192x192' }] },
          { name: 'Emergency', short_name: 'SOS',  description: 'Emergency contacts & SOS', url: '/emergency', icons: [{ src: 'icons/pwa-192x192.png', sizes: '192x192' }] },
          { name: 'Mess Menu', short_name: 'Mess', description: 'View menu & opt out', url: '/mess', icons: [{ src: 'icons/pwa-192x192.png', sizes: '192x192' }] },
        ],
        categories: ['productivity', 'utilities'],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
