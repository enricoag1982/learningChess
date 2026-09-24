import { expect, test } from '@playwright/test';
import type { CompiledContent, TracksCatalog } from '@chess-kids/core';
import { nextLesson } from '@chess-kids/core';
import rawContent from '@chess-kids/content/content.json' with { type: 'json' };
import rawTracks from '@chess-kids/content/tracks.json' with { type: 'json' };
import { completeFirstRun, homeGreeting, pickProfileFromPicker } from './helpers.ts';

const content = rawContent as unknown as CompiledContent;
const catalog = rawTracks as unknown as TracksCatalog;

interface Manifest {
  readonly name: string;
  readonly icons: readonly unknown[];
}

/** The Journey's very first lesson for a brand-new profile — whichever one that turns out to be. */
function firstJourneyLesson() {
  const lesson = nextLesson(catalog, content.lessons, []);
  if (!lesson) throw new Error('bundled content/tracks: no first lesson found');
  return lesson;
}

test('loads the app shell with a valid manifest and no console errors', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await completeFirstRun(page, 'Mia');

  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { level: 1, name: 'Chess for Kids' })).toBeVisible();
  await expect(page.getByText(homeGreeting(firstJourneyLesson()))).toBeVisible();

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
