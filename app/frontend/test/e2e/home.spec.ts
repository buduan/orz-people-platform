import { expect, test } from '@playwright/test';

test('shows the platform engineering baseline', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Nuxt frontend is ready');
  await expect(page.getByText('orz-people-platform-frontend')).toBeVisible();
});
