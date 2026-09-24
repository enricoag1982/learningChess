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
  seedLessonsMastered,
  waitForVersusTurnOrEnd,
} from './helpers.ts';

const content = rawContent as unknown as CompiledContent;
const catalog = rawTracks as unknown as TracksCatalog;

/**
 * Direct Pawn Wars test (M2.6): a fixed `chess-kids:test-seed` makes the Mouse-level bot
 * deterministic and shortens its "thinking" pause, so this focuses purely on the versus boss
 * itself — every prior lesson is seeded mastered (`journey.spec.ts`'s pattern) rather than played.
 */
test.describe('Pawn Wars (versus boss vs. the seeded Mouse)', () => {
  test('every kid move gets a bot reply within 3s, playing the game to its end', async ({
    page,
  }) => {
    const lesson = findLesson('pawn');
    const boss = findMiniGame('pawn-wars-4');
    if (boss.mode !== 'versus') {
      throw new Error('pawn-wars-4 is expected to be a versus mini-game');
    }

    const orderedLessons = lessonsInJourneyOrder(catalog, content.lessons);
    const pawnIndex = orderedLessons.findIndex((entry) => entry.id === 'pawn');
    if (pawnIndex < 0) {
      throw new Error('bundled content: "pawn" lesson not found in journey order');
    }
    const before = orderedLessons.slice(0, pawnIndex);

    await completeFirstRun(page, 'Kid');
    // Deterministic bot from its very first move, and a short (not skipped) "thinking" pause.
    await page.evaluate(() => {
      localStorage.setItem('chess-kids:test-seed', '424242');
    });

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

    // Now on the Pawn Wars Jr. boss, kid to move.
    await expect(page.getByText(contentText(boss.goalKey))).toBeVisible();

    let kidMoves = 0;
    for (;;) {
      const status = await page.locator('[data-versus-status]').getAttribute('data-versus-status');
      if (status !== 'playing') break;
      kidMoves += 1;
      expect(kidMoves, 'pawn-wars-4 should end well within its move limit').toBeLessThanOrEqual(
        boss.rules.moveLimit ?? 30,
      );

      const start = Date.now();
      await playOneKidVersusMove(page, boss);
      await waitForVersusTurnOrEnd(page);
      const elapsedMs = Date.now() - start;
      expect(elapsedMs, `bot did not reply within 3s (took ${String(elapsedMs)}ms)`).toBeLessThan(
        3000,
      );
    }

    expect(kidMoves, 'the game should have played at least one kid move').toBeGreaterThan(0);

    const finalStatus = await page
      .locator('[data-versus-status]')
      .getAttribute('data-versus-status');
    expect(finalStatus, 'the game should have a final result').not.toBe('playing');
    await expect(page.locator('[data-testid="stars-row"]')).toBeVisible();

    await page.getByRole('button', { name: /^Next/ }).click();
  });
});
