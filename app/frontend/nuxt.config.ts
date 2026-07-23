import { fileURLToPath } from 'node:url';
import { config as loadEnvironment } from 'dotenv';

loadEnvironment({
  path: fileURLToPath(new URL('../../.env', import.meta.url)),
  quiet: true,
});

// The root .env defines PORT for the backend. Nuxt dev binds PORT as a
// secondary listener next to NUXT_PORT, which steals the backend's port when
// both apps start together, so it must not leak into the Nuxt process.
delete process.env.PORT;

const backendOrigin = process.env.BACKEND_ORIGIN ?? 'http://localhost:6771';

export default defineNuxtConfig({
  alias: {
    '@': fileURLToPath(new URL('./', import.meta.url)),
    '@orz-people-platform/utils': fileURLToPath(
      new URL('../../packages/utils/src/', import.meta.url),
    ),
  },
  css: ['~/assets/css/main.css'],
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/ui'],
  nitro: {
    // Keep auth cookies on the frontend origin during local development.
    // Production should proxy /api at the edge in the same way.
    devProxy: {
      '/api': {
        target: backendOrigin,
      },
    },
  },
  runtimeConfig: {
    public: {
      // Business API requests target the backend directly. Authentication uses
      // the same-origin /api proxy so its session cookie remains available.
      apiBase: 'http://localhost:3000',
    },
  },
  ui: {
    // Avoid build-time font-provider requests; the application uses system fonts by default.
    fonts: false,
  },
  typescript: {
    strict: true,
    typeCheck: true,
  },
});
