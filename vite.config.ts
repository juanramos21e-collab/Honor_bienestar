import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [react(), VitePWA({
    registerType: 'prompt',
    includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png', 'landscape.svg'],
    manifest: {
      id: '/', name: 'Honor · Mi bienestar', short_name: 'Honor', lang: 'es',
      description: 'Registra tu día y acompaña tu progreso.',
      start_url: '/', scope: '/', display: 'standalone',
      background_color: '#0a1618', theme_color: '#0a1618',
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
      ],
    },
    workbox: {
      maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      navigateFallbackDenylist: [/^\/__/, /^\/downloads\//],
      globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      cleanupOutdatedCaches: true,
    },
  })],
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
