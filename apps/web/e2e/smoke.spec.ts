import { expect, test } from '@playwright/test';
import { completeFirstRun, pickProfileFromPicker } from './helpers.ts';

interface Manifest {
  readonly name: string;
  readonly icons: readonly unknown[];
}

test('loads the app shell with a valid manifest and no console errors', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await completeFirstRun(page, 'Mia');

  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { level: 1, name: 'Chess for Kids' })).toBeVisible();
  await expect(page.getByText('Today you meet Rhino!')).toBeVisible();

  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(manifestHref).toBeTruthy();
  const manifestUrl = new URL(manifestHref ?? '', page.url()).toString();
  const manifestResponse = await page.request.get(manifestUrl);
  expect(manifestResponse.ok()).toBe(true);
  const manifest = (await manifestResponse.json()) as Manifest;
  expect(manifest.name).toBe('Chess for Kids');
  expect(manifest.icons).toHaveLength(3);

  expect(consoleErrors).toEqual([]);
});

test('keeps showing the app once offline, after the service worker is ready', async ({
  page,
  context,
}) => {
  await completeFirstRun(page, 'Mia');
  await expect(page.getByText('Ready to play offline.')).toBeVisible({ timeout: 15_000 });

  await context.setOffline(true);
  await page.reload();

  // Every reload shows the picker first (app-structure.md §3), even offline (all local storage).
  await expect(page.getByRole('heading', { name: "Who's playing today?" })).toBeVisible();
  await pickProfileFromPicker(page, 'Mia');
  await expect(page.getByRole('heading', { level: 1, name: 'Chess for Kids' })).toBeVisible();
});
