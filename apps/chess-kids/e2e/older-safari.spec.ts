import { expect, test } from '@playwright/test';
import { completeFirstRun } from './helpers.ts';

// Oldest supported browser: Safari 15.4 (iPad mini 4, iOS 15.8 — owner device, non-functional.md §4).
// Chromium here, with the Safari 15 differences that broke startup simulated.

test('starts where SpeechSynthesis is not an EventTarget (Safari < 16)', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(window.speechSynthesis, 'addEventListener', { value: undefined });
  });

  await completeFirstRun(page, 'Mia');

  await expect(page.getByRole('heading', { level: 1, name: 'Chess for Kids' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('a startup failure shows the error screen, not a blank page', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new Error('storage blocked');
    };
  });

  await page.goto('./');

  await expect(page.getByRole('heading', { name: 'Oops, something went wrong' })).toBeVisible();
  await expect(page.getByText('storage blocked')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
});
