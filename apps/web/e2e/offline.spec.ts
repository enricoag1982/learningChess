import { expect, test } from '@playwright/test';
import type { CompiledContent, TracksCatalog } from '@chess-kids/core';
import { nextLesson } from '@chess-kids/core';
import rawContent from '@chess-kids/content/content.json' with { type: 'json' };
import rawTracks from '@chess-kids/content/tracks.json' with { type: 'json' };
import { completeExercise, completeFirstRun, pickProfileFromPicker } from './helpers.ts';

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
