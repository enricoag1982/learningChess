import { expect, test } from '@playwright/test';
import {
  completeFirstRun,
  contentText,
  findLesson,
  getSoleProfileId,
  interpolate,
  lessonLabel,
  pickProfileFromPicker,
  seedConceptStats,
  seedLessonMastered,
  solveWhicheverExercise,
} from './helpers.ts';

test.describe('Today session (M3.4: warm-up + review scheduler)', () => {
  test('Start today runs the 3 due warm-up tasks, then lands in the next lesson', async ({
    page,
  }) => {
    const lines = findLesson('lines');
    const setup = findLesson('setup');
    const squares = findLesson('squares');

    await completeFirstRun(page, 'Kid');
    const profileId = await getSoleProfileId(page);

    // 3 concepts due now (board world's Owl-taught lessons: simple exercise types, robust to solve
    // sight-unseen). Seeded directly — no need to have played them wrong first.
    await seedConceptStats(page, profileId, lines.concept);
    await seedConceptStats(page, profileId, setup.concept);
    await seedConceptStats(page, profileId, squares.concept);

    await page.reload();
    await pickProfileFromPicker(page, 'Kid');

    await page.getByRole('button', { name: /Start today/ }).click();

    const candidates = [...lines.exercises, ...setup.exercises, ...squares.exercises];
    for (let i = 1; i <= 3; i += 1) {
      await expect(
        page.getByText(interpolate(contentText('session.warmup-of'), { current: i, total: 3 })),
      ).toBeVisible();
      await solveWhicheverExercise(page, candidates);
    }

    // Warm-up done: the session's next activity is the Journey's next lesson (its story step).
    await expect(page.getByRole('button', { name: /Let me try/ })).toBeVisible();
  });

  test('Practice: a topic run of 5 tasks returns to the topic list', async ({ page }) => {
    const lines = findLesson('lines');

    await completeFirstRun(page, 'Kid');
    const profileId = await getSoleProfileId(page);
    await seedLessonMastered(page, profileId, lines);

    await page.reload();
    await pickProfileFromPicker(page, 'Kid');

    await page.getByRole('button', { name: 'Practice' }).click();
    await page.getByRole('button', { name: new RegExp(lessonLabel(lines)) }).click();

    for (let i = 1; i <= 5; i += 1) {
      await expect(
        page.getByText(interpolate(contentText('practice.topic-of'), { current: i, total: 5 })),
      ).toBeVisible();
      await solveWhicheverExercise(page, lines.exercises);
    }

    // Back on the Practice topic list, not stuck in the run.
    await expect(page.getByRole('heading', { name: 'Practice' })).toBeVisible();
    await expect(page.getByText('Topics')).toBeVisible();
  });
});
