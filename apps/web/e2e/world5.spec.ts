import { expect, test } from '@playwright/test';
import type { CompiledContent, TracksCatalog } from '@chess-kids/core';
import rawContent from '@chess-kids/content/content.json' with { type: 'json' };
import rawTracks from '@chess-kids/content/tracks.json' with { type: 'json' };
import {
  completeFirstRun,
  findLesson,
  getSoleProfileId,
  journeyNodeName,
  lessonsInJourneyOrder,
  pickProfileFromPicker,
  playLesson,
  seedLessonsMastered,
  seedMiniGameWon,
  worldTabName,
} from './helpers.ts';

const content = rawContent as unknown as CompiledContent;
const catalog = rawTracks as unknown as TracksCatalog;

/** Every lesson (in journey order) before `lessonId`, for seeding "already mastered" progress. */
function lessonsBefore(lessonId: string) {
  const ordered = lessonsInJourneyOrder(catalog, content.lessons);
  const index = ordered.findIndex((entry) => entry.id === lessonId);
  if (index < 0) {
    throw new Error(`bundled content: "${lessonId}" lesson not found in journey order`);
  }
  return ordered.slice(0, index);
}

/**
 * Seeds every lesson before `lessonId` mastered, plus the two earlier world bosses (World 3's
 * `win-the-queen`, World 4's `first-game`) that `isWorldMastered` also requires on top of each
 * lesson's own `bossStars` (`journey.spec.ts`'s / `world4.spec.ts`'s own pattern) — enough for any
 * World 5 lesson up to and including `lessonId` to be reachable from the Journey.
 */
async function seedUpTo(page: import('@playwright/test').Page, lessonId: string): Promise<void> {
  const profileId = await getSoleProfileId(page);
  await seedLessonsMastered(page, profileId, lessonsBefore(lessonId));
  await seedMiniGameWon(page, profileId, 'win-the-queen');
  await seedMiniGameWon(page, profileId, 'first-game');
  await page.reload();
  await expect(page.getByRole('heading', { name: "Who's playing today?" })).toBeVisible();
  await pickProfileFromPicker(page, 'Kid');
}

/**
 * World 5 "Castling" (M4.1, no boss of its own — `docs/curriculum.md` World 5): every prior world
 * mastered, then the lesson is played end to end via `playLesson` — story, demo, both guided tries,
 * all 8 exercises (yes-no `can-castle` and best-move `castle`, the two new verify kinds this
 * milestone adds), same generic `solveExercise` helper every other lesson type uses.
 */
test.describe('World 5: Castling lesson to completion', () => {
  test('plays every guided try and exercise via solveExercise (best-move castle, yes-no can-castle)', async ({
    page,
  }) => {
    const lesson = findLesson('castling');

    await completeFirstRun(page, 'Kid');
    await seedUpTo(page, 'castling');

    await page.getByRole('button', { name: /Journey/ }).click();
    await page.getByRole('button', { name: worldTabName(catalog, lesson.world) }).click();
    await page.getByRole('button', { name: journeyNodeName(lesson, 'current') }).click();
    await page.getByRole('button', { name: /Let me try/ }).click(); // Story -> Demo
    await page.getByRole('button', { name: /^Next/ }).click(); // Demo -> first guided try

    await playLesson(page, lesson, content.minigames);

    await expect(page.getByRole('heading', { name: 'Lesson complete!' })).toBeVisible();
  });
});

/**
 * World 5 "En passant" (M4.1): its first guided try is a best-move exercise authored with
 * `lastMove: d7d5` (the double step that makes the capture legal) — the board must show that move's
 * highlight tint on d7 and d5 from the very start, before the kid plays anything (`exercise-reducer.ts`'s
 * `initExerciseState` seeding, `Board.tsx`'s existing `highlights.lastMove` tint).
 */
test.describe("World 5: En passant shows the opponent's last move", () => {
  test("highlights the double-step squares (d7, d5) before the kid's first move", async ({
    page,
  }) => {
    const castling = findLesson('castling');
    const enPassant = findLesson('en-passant');

    await completeFirstRun(page, 'Kid');
    await seedUpTo(page, 'en-passant');

    await page.getByRole('button', { name: /Journey/ }).click();
    await page.getByRole('button', { name: worldTabName(catalog, castling.world) }).click();
    await page.getByRole('button', { name: journeyNodeName(enPassant, 'current') }).click();
    await page.getByRole('button', { name: /Let me try/ }).click(); // Story -> Demo
    await page.getByRole('button', { name: /^Next/ }).click(); // Demo -> first guided try (best-move en passant)

    const from = page.getByRole('button', { name: /^d7,/ });
    const to = page.getByRole('button', { name: /^d5,/ });
    await expect(from).toBeVisible();
    const fromHasHighlight = await from.evaluate((element) =>
      Array.from(element.querySelectorAll('span')).some((span) =>
        span.className.includes('F4D35E'),
      ),
    );
    const toHasHighlight = await to.evaluate((element) =>
      Array.from(element.querySelectorAll('span')).some((span) =>
        span.className.includes('F4D35E'),
      ),
    );
    expect(fromHasHighlight, 'd7 (lastMove.from) should show the last-move tint').toBe(true);
    expect(toHasHighlight, 'd5 (lastMove.to) should show the last-move tint').toBe(true);
  });
});
