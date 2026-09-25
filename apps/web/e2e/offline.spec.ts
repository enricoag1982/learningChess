import { expect, test } from '@playwright/test';
import type { CompiledContent, TracksCatalog } from '@chess-kids/core';
import { nextLesson } from '@chess-kids/core';
import rawContent from '@chess-kids/content/content.json' with { type: 'json' };
import rawTracks from '@chess-kids/content/tracks.json' with { type: 'json' };
import {
  completeExercise,
  completeFirstRun,
  findLesson,
  getSoleProfileId,
  journeyNodeName,
  pickProfileFromPicker,
  seedWorldFourMastered,
  worldTabName,
} from './helpers.ts';

const content = rawContent as unknown as CompiledContent;
const catalog = rawTracks as unknown as TracksCatalog;

test('plays a guided try and an exercise fully offline, with progress saved', async ({
  page,
  context,
}) => {
  // Whichever lesson the Journey currently offers first (see `journey.spec.ts`), not a hardcoded id.
  const lesson = nextLesson(catalog, content.lessons, []);
  if (!lesson) throw new Error('bundled content/tracks: no first lesson found');
  const [firstExercise] = lesson.exercises;
  if (lesson.guided.length === 0 || !firstExercise) {
    throw new Error('first lesson fixture needs at least one guided try and one exercise');
  }

  await completeFirstRun(page, 'Kid');
  await expect(page.getByText('Ready to play offline.')).toBeVisible({ timeout: 15_000 });

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: "Who's playing today?" })).toBeVisible();
  await pickProfileFromPicker(page, 'Kid');

  await page.getByRole('button', { name: /Start/ }).click();
  await page.getByRole('button', { name: /Let me try/ }).click(); // Story -> Demo
  await page.getByRole('button', { name: /^Next/ }).click(); // Demo -> first guided try

  // All guided tries first (the lesson flow requires each in order), then one scored exercise —
  // of whichever type it is, `completeExercise` solves any of them.
  for (const guided of lesson.guided) {
    await completeExercise(page, guided);
  }
  await completeExercise(page, firstExercise);

  // Progress is saved to localStorage (no network involved), and survives a reload — still
  // offline (non-functional.md §1: the whole app, including progress, works with no network).
  const starsPill = page.locator('[aria-label$=" stars"]');
  await expect(starsPill).toHaveAttribute('aria-label', /^(?!0 stars$).+/);

  await page.reload();
  await expect(page.getByRole('heading', { name: "Who's playing today?" })).toBeVisible();
  await pickProfileFromPicker(page, 'Kid');
  await expect(starsPill).toHaveAttribute('aria-label', /^(?!0 stars$).+/);
});

test('a lazy-loaded screen (parent area) and a World 5 exercise both work after going offline', async ({
  page,
  context,
}) => {
  // M5.4 (non-functional.md §1/§4 "Lazy loading"/"Precache"): the parent area is one of the
  // screens `App.tsx` now code-splits into its own chunk (`React.lazy`), never fetched during
  // this test's own online session below (Home -> Journey -> World 5 never visits it) — so it can
  // only work offline because the service worker precached *every* chunk up front, not only the
  // ones a session happened to touch.
  const castling = findLesson('castling');

  await completeFirstRun(page, 'Kid');
  const profileId = await getSoleProfileId(page);
  await seedWorldFourMastered(page, profileId, catalog, content.lessons);
  await page.reload();
  await expect(page.getByRole('heading', { name: "Who's playing today?" })).toBeVisible();
  await pickProfileFromPicker(page, 'Kid');

  await expect(page.getByText('Ready to play offline.')).toBeVisible({ timeout: 15_000 });

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: "Who's playing today?" })).toBeVisible();
  await pickProfileFromPicker(page, 'Kid');

  // Parent area (lazy chunk), still offline: opens and shows the same as it would online.
  await page.getByRole('button', { name: 'Switch player' }).click();
  await page.getByRole('button', { name: /Grown-ups/ }).click();
  await page.getByLabel('Password', { exact: true }).fill('1234');
  await page.getByRole('button', { name: 'Open' }).click();
  await expect(page.getByRole('heading', { name: 'Parent area' })).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();
  await pickProfileFromPicker(page, 'Kid');

  // World 5 ("rules"): Journey -> Castling -> guided tries -> first exercise, still offline.
  await page.getByRole('button', { name: /Journey/ }).click();
  await page.getByRole('button', { name: worldTabName(catalog, castling.world) }).click();
  await page.getByRole('button', { name: journeyNodeName(castling, 'current') }).click();
  await page.getByRole('button', { name: /Let me try/ }).click(); // Story -> Demo
  await page.getByRole('button', { name: /^Next/ }).click(); // Demo -> first guided try

  for (const guided of castling.guided) {
    await completeExercise(page, guided);
  }
  const [firstExercise] = castling.exercises;
  if (!firstExercise) throw new Error('"castling" lesson has no exercises');
  await completeExercise(page, firstExercise);

  const starsPill = page.locator('[aria-label$=" stars"]');
  await expect(starsPill).toHaveAttribute('aria-label', /^(?!0 stars$).+/);
});
