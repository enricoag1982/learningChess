import { expect, test } from '@playwright/test';
import type { CompiledContent, Lesson, TracksCatalog } from '@chess-kids/core';
import { nextLesson } from '@chess-kids/core';
import rawContent from '@chess-kids/content/content.json' with { type: 'json' };
import rawTracks from '@chess-kids/content/tracks.json' with { type: 'json' };
import {
  completeExercise,
  pickProfileFromPicker,
  playLesson,
  startLessonToFirstGuided,
} from './helpers.ts';

const content = rawContent as unknown as CompiledContent;
const catalog = rawTracks as unknown as TracksCatalog;

/**
 * The Journey's very first lesson for a brand-new profile (no progress, nothing unlocked) — the
 * same `nextLesson` the app's store calls via `loadJourney`. Computed from the bundled content so
 * this spec stays correct whichever lesson that turns out to be (currently World 1's Squares).
 */
function firstJourneyLesson(): Lesson {
  const lesson = nextLesson(catalog, content.lessons, []);
  if (!lesson) throw new Error('bundled content/tracks: no first lesson found');
  return lesson;
}

test.describe('First lesson (whichever the Journey currently offers)', () => {
  test('play the whole lesson end to end, then Continue and reload keep the result', async ({
    page,
    baseURL,
  }) => {
    const lesson = firstJourneyLesson();

    // Privacy (non-functional.md §3): no network requests except same-origin (no analytics, ads,
    // or third-party calls — everything the app needs is bundled and served locally).
    const baseOrigin = new URL(baseURL ?? 'http://localhost:4173/').origin;
    const externalRequests: string[] = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.origin !== baseOrigin) externalRequests.push(request.url());
    });

    await startLessonToFirstGuided(page);
    await playLesson(page, lesson, content.minigames);

    await expect(page.getByText('Lesson complete!')).toBeVisible();
    await page.getByRole('button', { name: /Continue/ }).click();

    // Home shows the stars just earned…
    const starsPill = page.locator('[aria-label$=" stars"]');
    await expect(starsPill).toHaveAttribute('aria-label', /^(?!0 stars$).+/);
    // …and the Owl announces the next lesson (more lessons exist in this world after this one).
    await expect(page.getByRole('button', { name: /Start today/ })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('heading', { name: "Who's playing today?" })).toBeVisible();
    await pickProfileFromPicker(page, 'Kid');
    await expect(starsPill).toHaveAttribute('aria-label', /^(?!0 stars$).+/);

    expect(
      externalRequests,
      `requests left the app origin: ${externalRequests.join(', ')}`,
    ).toEqual([]);
  });

  test('closing mid-lesson and reopening resumes at the same exercise', async ({ page }) => {
    const lesson = firstJourneyLesson();

    await startLessonToFirstGuided(page);

    for (const guided of lesson.guided) {
      await completeExercise(page, guided);
    }
    const [firstExercise, secondExercise] = lesson.exercises;
    if (!firstExercise || !secondExercise || lesson.exercises.length < 3) {
      throw new Error('first lesson needs at least 3 exercises for this test');
    }
    const stageThreeOfN = `3 of ${String(lesson.exercises.length)}`;

    // Solve exercises 1 and 2, then close right at the start of exercise 3.
    await completeExercise(page, firstExercise);
    await completeExercise(page, secondExercise);
    await expect(page.getByText(stageThreeOfN)).toBeVisible();

    await page.getByRole('button', { name: 'Close lesson' }).click();
    await expect(page.getByRole('button', { name: /Continue/ })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('heading', { name: "Who's playing today?" })).toBeVisible();
    await pickProfileFromPicker(page, 'Kid');
    await page.getByRole('button', { name: /Continue/ }).click();

    // Resumed at the same exercise (3 of N), not back at the story or an earlier one.
    await expect(page.getByText(stageThreeOfN)).toBeVisible();
  });
});
