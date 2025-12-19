import { test, expect } from '@playwright/test';

test('theme toggle works', async ({ page }) => {
  await page.goto('/');

  const html = page.locator('html');

  // Wait for the initial theme to be set
  await expect(html).toHaveAttribute('data-theme', /^(dark|light)$/, { timeout: 10000 });

  // Get the initial theme
  const initialTheme = await html.getAttribute('data-theme');

  // Determine the expected theme after the toggle
  const expectedTheme = initialTheme === 'light' ? 'dark' : 'light';

  // Click the toggle button using its test ID
  await page.locator('[data-testid="theme-toggle"]').click();

  // Assert the theme has changed to the opposite value
  await expect(html).toHaveAttribute('data-theme', expectedTheme, { timeout: 10000 });

  // Take a screenshot to visually confirm the final state
  await page.screenshot({ path: 'screenshot.png' });
});
