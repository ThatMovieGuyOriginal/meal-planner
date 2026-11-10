/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';
import vercel from './vercel.json' with { type: 'json' };

// `vite preview` serves the production headers too, so the CSP gets exercised locally.
const allPaths = vercel.headers.find((h) => h.source === '/(.*)');
const previewHeaders = Object.fromEntries((allPaths?.headers ?? []).map((h) => [h.key, h.value]));

export default defineConfig({
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      // Registered from src/app/updates.ts, which reloads into a new version at a safe moment.
      injectRegister: false,
      includeAssets: ['icon.svg', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Body Composition & Meal Planner',
        short_name: 'Meal Planner',
        description: 'Personal calorie, macro and meal planning.',
        start_url: '/',
        display: 'standalone',
        background_color: '#f4f7fb',
        theme_color: '#192d55',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
      },
    }),
  ],
  preview: { headers: previewHeaders },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
