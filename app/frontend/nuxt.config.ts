import { fileURLToPath } from 'node:url';
import { config as loadEnvironment } from 'dotenv';

loadEnvironment({
  path: fileURLToPath(new URL('../../.env', import.meta.url)),
  quiet: true,
});

export default defineNuxtConfig({
  alias: {
    '@orz-people-platform/types': fileURLToPath(
      new URL('../../packages/types/src/', import.meta.url),
    ),
    '@orz-people-platform/utils': fileURLToPath(
      new URL('../../packages/utils/src/', import.meta.url),
    ),
  },
  css: ['~/assets/css/main.css'],
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/ui'],
  runtimeConfig: {
    public: {
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
