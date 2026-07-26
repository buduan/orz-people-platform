import { fileURLToPath } from 'node:url';
import { config as loadEnvironment } from 'dotenv';

loadEnvironment({
  path: fileURLToPath(new URL('../../.env', import.meta.url)),
  quiet: true,
});

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
  modules: ['@nuxt/ui', '@pinia/nuxt'],
  runtimeConfig: {
    public: {
      apiBase: 'http://localhost:3000',
    },
  },
  fonts: {
    families: [
      {
        name: 'Noto Sans SC',
        provider: 'google',
        global: true,
        weights: [400, 500, 600, 700],
      },
      {
        name: 'Inter',
        provider: 'google',
        global: true,
        weights: [400, 500, 600, 700],
      },
    ],
  },
  ui: {
    fonts: true,
  },
  typescript: {
    strict: true,
    typeCheck: true,
  },
});
