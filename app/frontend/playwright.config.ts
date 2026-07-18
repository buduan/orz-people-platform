import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  expect: {
    timeout: 5_000,
  },
  fullyParallel: true,
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  reporter: 'list',
  testDir: './test/e2e',
  use: {
    baseURL: 'http://127.0.0.1:3301',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'pnpm dev:test',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    url: 'http://127.0.0.1:3301',
  },
});
