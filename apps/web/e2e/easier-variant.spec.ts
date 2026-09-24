import { expect, test } from '@playwright/test';
import type { CollectStarsDef, CompiledContent, TracksCatalog } from '@chess-kids/core';
import { lessonSteps } from '@chess-kids/core';
import rawContent from '@chess-kids/content/content.json' with { type: 'json' };
import rawTracks from '@chess-kids/content/tracks.json' with { type: 'json' };
import {
  clickSquare,
  completeFirstRun,
  contentText,
  findLesson,
  getSoleProfileId,
  lessonsInJourneyOrder,
  pickProfileFromPicker,
  playSolveLine,
  readLessonBestStars,
  seedLessonProgress,
  seedLessonsMastered,
} from './helpers.ts';

const content = rawContent as unknown as CompiledContent;
const catalog = rawTracks as unknown as TracksCatalog;

test.describe('2 errors offer an easier variant (teaching-process.md §3.3)', () => {
  test('rook-04: 2 errors offer rook-04-easy; solving it credits rook-04 and continues to rook-05', async ({
    page,
  }) => {
    const rook = findLesson('rook');
    const rookExerciseIndex = rook.exercises.findIndex((exercise) => exercise.id === 'rook-04');
    const rook04 = rook.exercises[rookExerciseIndex];
    const rook05 = rook.exercises[rookExerciseIndex + 1];
    const variant = rook.variants?.find((entry) => entry.id === 'rook-04-easy');
    if (rookExerciseIndex < 0 || !rook04 || !rook05 || !variant) {
      throw new Error(
        'bundled Rook content is missing rook-04, rook-05 or its rook-04-easy variant',
      );
    }
    if (variant.type !== 'collect-stars') {
      throw new Error('rook-04-easy is expected to be a collect-stars exercise');
    }
    const easyVariant: CollectStarsDef = variant;

    // Where rook-04 sits in the lesson's own step order (see `lessonSteps`), for the resumeStep seed.
    const rook04StepIndex = lessonSteps(rook, content.minigames).findIndex(
      (step) => step.kind === 'exercise' && step.exercise.id === 'rook-04',
    );
    if (rook04StepIndex < 0) throw new Error('rook-04 not found in lessonSteps(rook, ...)');

    await completeFirstRun(page, 'Kid');
    const profileId = await getSoleProfileId(page);

    // Master every lesson before Rook (World 1, "board") so Rook is the Journey's current lesson.
    const journeyOrder = lessonsInJourneyOrder(catalog, content.lessons);
    const rookOrderIndex = journeyOrder.findIndex((lesson) => lesson.id === 'rook');
    await seedLessonsMastered(page, profileId, journeyOrder.slice(0, rookOrderIndex));

    // Rook itself: rook-01..rook-03 already 3-starred, resuming right at rook-04 (still
    // "in-progress", not "complete" — leaving `resumeStep` in charge, not a story restart).
    const bestStarsSoFar = Object.fromEntries(
      rook.exercises.slice(0, rookExerciseIndex).map((exercise) => [exercise.id, 3]),
    ) as Record<string, 1 | 2 | 3>;
    await seedLessonProgress(page, profileId, rook, bestStarsSoFar, rook04StepIndex);

    await page.reload();
    await expect(page.getByRole('heading', { name: "Who's playing today?" })).toBeVisible();
    await pickProfileFromPicker(page, 'Kid');
    await page.getByRole('button', { name: /Continue/ }).click();

    // Landed directly on rook-04, not the story or an earlier exercise.
    await expect(page.getByText(contentText(rook04.textKey))).toBeVisible();

    // 2 illegal moves (a1 -> b2 is never legal for a rook): tap a1 once, then b2 twice — an
    // illegal attempt leaves the piece selected, so a second b2 tap is already the 2nd attempt.
    await clickSquare(page, 'a1');
    await clickSquare(page, 'b2');
    await clickSquare(page, 'b2');

    // Offered, never forced: the extra sentence plus a real (>=64px tall) button.
    await expect(page.getByText(contentText('exercise.easier-offer'))).toBeVisible();
    const easierButton = page.getByRole('button', {
      name: contentText('exercise.easier'),
      exact: true,
    });
    await expect(easierButton).toBeVisible();
    const box = await easierButton.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(64);

    await easierButton.click();

    // Swapped to the variant, in the same lesson step.
    await expect(page.getByText(contentText(variant.textKey))).toBeVisible();
    await playSolveLine(page, easyVariant.position, 'collect-stars');

    // 1 star only (the "completed" tier), regardless of how well the variant itself was solved.
    const filledStars = await page
      .getByTestId('stars-row')
      .locator('span:not(.opacity-25)')
      .count();
    expect(filledStars).toBe(1);

    await page.getByRole('button', { name: /^Next/ }).click();
    await expect(page.getByText(contentText(rook05.textKey))).toBeVisible();

    // The original exercise is credited, never the variant.
    const bestStars = await readLessonBestStars(page, profileId, 'rook');
    expect(bestStars['rook-04']).toBe(1);
    expect(bestStars['rook-04-easy']).toBeUndefined();
  });
});
