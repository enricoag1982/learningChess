import { expect, test } from '@playwright/test';
import type { CompiledContent, TracksCatalog } from '@chess-kids/core';
import rawContent from '@chess-kids/content/content.json' with { type: 'json' };
import rawTracks from '@chess-kids/content/tracks.json' with { type: 'json' };
import {
  completeExercise,
  completeFirstRun,
  contentText,
  findLesson,
  findMiniGame,
  getSoleProfileId,
  journeyNodeName,
  lessonsInJourneyOrder,
  pickProfileFromPicker,
  playOneKidVersusMove,
  seedLessonMastered,
  seedLessonsMastered,
  waitForVersusTurnOrEnd,
} from './helpers.ts';

const content = rawContent as unknown as CompiledContent;
const catalog = rawTracks as unknown as TracksCatalog;

/**
 * World 3 "Attack" (M3.2b): every prior lesson is seeded mastered (`pawn-wars.spec.ts`'s pattern),
 * then the lesson is played end to end — story, demo, both guided tries, all 8 exercises (3
 * select-squares `derive: attacked-by`, 5 best-move `verify: attack`) — up to its `queen-vs-pawns`
 * boss screen. One kid move there proves the versus boss itself is playable; finishing the whole
 * game against the bot is covered by the winnability test (`winnability.test.ts`), not here.
 */
test.describe('World 3: Attack lesson to its boss screen', () => {
  test('plays every guided try and exercise, then reaches the Queen vs Pawns boss', async ({
    page,
  }) => {
    const lesson = findLesson('attack');
    const boss = findMiniGame('queen-vs-pawns');
    if (boss.mode !== 'versus') {
      throw new Error('queen-vs-pawns is expected to be a versus mini-game');
    }

    const orderedLessons = lessonsInJourneyOrder(catalog, content.lessons);
    const attackIndex = orderedLessons.findIndex((entry) => entry.id === 'attack');
    if (attackIndex < 0) {
      throw new Error('bundled content: "attack" lesson not found in journey order');
    }
    const before = orderedLessons.slice(0, attackIndex);

    await completeFirstRun(page, 'Kid');
    const profileId = await getSoleProfileId(page);
    await seedLessonsMastered(page, profileId, before);
    await page.reload();
    await expect(page.getByRole('heading', { name: "Who's playing today?" })).toBeVisible();
    await pickProfileFromPicker(page, 'Kid');

    await page.getByRole('button', { name: /Journey/ }).click();
    await page.getByRole('button', { name: journeyNodeName(lesson, 'current') }).click();
    await page.getByRole('button', { name: /Let me try/ }).click(); // Story -> Demo
    await page.getByRole('button', { name: /^Next/ }).click(); // Demo -> first guided try

    for (const guided of lesson.guided) {
      await completeExercise(page, guided);
    }
    for (const exercise of lesson.exercises) {
      await completeExercise(page, exercise);
    }

    // Now on the Queen vs Pawns boss, kid to move.
    await expect(page.getByText(contentText(boss.goalKey))).toBeVisible();
    await expect(page.locator('[data-versus-status]')).toHaveAttribute(
      'data-versus-status',
      'playing',
    );

    await playOneKidVersusMove(page, boss);
    await waitForVersusTurnOrEnd(page);
    // The bot replied (or the game already ended after one kid capture): either way the boss is
    // live and responsive, which is as far as this spec needs to go.
  });
});

/**
 * "Safe or Not?" (series boss of `safe-pieces`), played standalone from the Play screen: unlocked
 * by seeding the `safe-pieces` lesson mastered, same approach `play.spec.ts` uses for Hungry Rook.
 * Every round is a `yes-no` `verify: hanging` check; solved with its own authored answer, same as
 * `world3-playthrough.test.ts` (content-only) proves for every round already.
 */
test.describe('Play screen: Safe or Not? series', () => {
  test('playing all 10 rounds standalone saves stars, shown on the Play tile', async ({ page }) => {
    const safePieces = findLesson('safe-pieces');
    const safeOrNot = findMiniGame('safe-or-not');
    if (safeOrNot.mode !== 'series') {
      throw new Error('safe-or-not is expected to be a series mini-game');
    }

    await completeFirstRun(page, 'Kid');
    const profileId = await getSoleProfileId(page);
    await seedLessonMastered(page, profileId, safePieces);
    await page.reload();
    await expect(page.getByRole('heading', { name: "Who's playing today?" })).toBeVisible();
    await pickProfileFromPicker(page, 'Kid');

    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Play' })).toBeVisible();
    const tile = page.getByRole('button', { name: /^Safe or Not\?,/ });
    await expect(tile).toBeVisible();
    await tile.click();

    await expect(page.getByRole('heading', { name: 'Safe or Not?' })).toBeVisible();
    for (const round of safeOrNot.rounds) {
      await completeExercise(page, round);
    }

    await expect(page.locator('[data-testid="stars-row"]')).toBeVisible();
    await page.getByRole('button', { name: /Back to Play/ }).click();

    await expect(page.getByRole('heading', { name: 'Play' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Safe or Not?, 3 stars' })).toBeVisible();
  });
});
