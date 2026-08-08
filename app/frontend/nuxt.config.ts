import { fileURLToPath } from 'node:url';
import { config as loadEnvironment } from 'dotenv';

loadEnvironment({
  path: fileURLToPath(new URL('../../.env', import.meta.url)),
  quiet: true,
});

export default defineNuxtConfig({
  devServer: { port: 6771 },
  alias: {
    '@': fileURLToPath(new URL('./', import.meta.url)),
    '@orz-people-platform/types': fileURLToPath(
      new URL('../../packages/types/src/', import.meta.url),
    ),
    '@orz-people-platform/utils': fileURLToPath(
      new URL('../../packages/utils/src/', import.meta.url),
    ),
  },
  css: ['~/assets/css/main.css'],
  compatibilityDate: '2025-07-15',
  devtools: {
    enabled: true,

    timeline: {
      enabled: true,
    },
  },
  modules: ['@nuxt/ui', '@pinia/nuxt'],
  runtimeConfig: {
    public: {
      apiOrigin: process.env.API_ORIGIN || 'http://localhost:6770',
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
