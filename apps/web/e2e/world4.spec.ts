import { expect, test } from '@playwright/test';
import type { CompiledContent, TracksCatalog } from '@chess-kids/core';
import rawContent from '@chess-kids/content/content.json' with { type: 'json' };
import rawTracks from '@chess-kids/content/tracks.json' with { type: 'json' };
import {
  completeFirstRun,
  contentText,
  findLesson,
  findMiniGame,
  getSoleProfileId,
  journeyNodeName,
  lessonsInJourneyOrder,
  pickProfileFromPicker,
  playLesson,
  playOneKidVersusMove,
  seedLessonsMastered,
  seedMiniGameWon,
  waitForVersusTurnOrEnd,
  worldTabName,
} from './helpers.ts';

const content = rawContent as unknown as CompiledContent;
const catalog = rawTracks as unknown as TracksCatalog;

/**
 * World 4 "Mate in 1" (M3.3): every prior lesson (Worlds 1-3 plus Check, Escape the Check,
 * Checkmate) is seeded mastered, then the lesson is played end to end via `playLesson` — story,
 * demo, both guided tries, all 12 `mate-in-n` exercises (each solved with `solveExercise`, the same
 * generic helper as every other exercise type), and its `mate-hunt` series boss (all 10 rounds).
 */
test.describe('World 4: Mate in 1 lesson to and through its boss', () => {
  test('plays every guided try, exercise and mate-hunt round via solveExercise', async ({
    page,
  }) => {
    const lesson = findLesson('mate-in-1');
    const boss = findMiniGame('mate-hunt');
    if (boss.mode !== 'series') {
      throw new Error('mate-hunt is expected to be a series mini-game');
    }

    const orderedLessons = lessonsInJourneyOrder(catalog, content.lessons);
    const lessonIndex = orderedLessons.findIndex((entry) => entry.id === 'mate-in-1');
    if (lessonIndex < 0) {
      throw new Error('bundled content: "mate-in-1" lesson not found in journey order');
    }
    const before = orderedLessons.slice(0, lessonIndex);

    await completeFirstRun(page, 'Kid');
    const profileId = await getSoleProfileId(page);
    await seedLessonsMastered(page, profileId, before);
    // World 3 "attack" has its own world boss (`win-the-queen`): its `MiniGameProgress` win is
    // needed too, on top of every lesson's own `bossStars`, before World 3 counts as "mastered" and
    // so unlocks World 4 on the Journey map (`seedMiniGameWon`'s doc comment).
    await seedMiniGameWon(page, profileId, 'win-the-queen');
    await page.reload();
    await expect(page.getByRole('heading', { name: "Who's playing today?" })).toBeVisible();
    await pickProfileFromPicker(page, 'Kid');

    await page.getByRole('button', { name: /Journey/ }).click();
    // World 3's own world boss (`win-the-queen`) is won (seeded above), so the Journey's default
    // tab already advances past it — but click the "check" world tab explicitly, robust either way.
    await page.getByRole('button', { name: worldTabName(catalog, lesson.world) }).click();
    await page.getByRole('button', { name: journeyNodeName(lesson, 'current') }).click();
    await page.getByRole('button', { name: /Let me try/ }).click(); // Story -> Demo
    await page.getByRole('button', { name: /^Next/ }).click(); // Demo -> first guided try

    await playLesson(page, lesson, content.minigames);

    await expect(page.getByRole('heading', { name: 'Lesson complete!' })).toBeVisible();
  });
});

/**
 * World 4's world boss `first-game` (M3.3): kid White vs Mouse on the standard starting position,
 * real check rules. Unlocked (same as any other mini-game, `docs/domain-model.md` §1.4) once the
 * `stalemate` lesson is complete, so it is reachable from the Play screen without any special
 * world-boss navigation. A seeded bot keeps every reply fast and deterministic (`pawn-wars.spec.ts`'s
 * pattern); the game itself is proven winnable by `winnability.test.ts`, so this only smoke-tests
 * the UI: it starts, 3 kid moves each get a bot reply within 3s, and leaving mid-game works.
 */
test.describe('World 4 world boss: first-game (seeded smoke test)', () => {
  test('starts, plays 3 kid moves with fast bot replies, and can be left mid-game', async ({
    page,
  }) => {
    const boss = findMiniGame('first-game');
    if (boss.mode !== 'versus') {
      throw new Error('first-game is expected to be a versus mini-game');
    }

    const orderedLessons = lessonsInJourneyOrder(catalog, content.lessons);
    const stalemateIndex = orderedLessons.findIndex((entry) => entry.id === 'stalemate');
    if (stalemateIndex < 0) {
      throw new Error('bundled content: "stalemate" lesson not found in journey order');
    }
    const before = orderedLessons.slice(0, stalemateIndex + 1);

    await completeFirstRun(page, 'Kid');
    // Deterministic bot from its very first move, and a short (not skipped) "thinking" pause.
    await page.evaluate(() => {
      localStorage.setItem('chess-kids:test-seed', '20260924');
    });

    const profileId = await getSoleProfileId(page);
    await seedLessonsMastered(page, profileId, before);
    await page.reload();
    await expect(page.getByRole('heading', { name: "Who's playing today?" })).toBeVisible();
    await pickProfileFromPicker(page, 'Kid');

    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Play' })).toBeVisible();
    const tile = page.getByRole('button', { name: /^Your First Full Game!,/ });
    await expect(tile).toBeVisible();
    await tile.click();

    // Start: kid to move on the standard position, real check rules in force.
    await expect(page.getByText(contentText(boss.goalKey))).toBeVisible();
    await expect(page.locator('[data-versus-status]')).toHaveAttribute(
      'data-versus-status',
      'playing',
    );

    for (let move = 0; move < 3; move += 1) {
      const start = Date.now();
      await playOneKidVersusMove(page, boss);
      await waitForVersusTurnOrEnd(page);
      const elapsedMs = Date.now() - start;
      expect(elapsedMs, `bot did not reply within 3s (took ${String(elapsedMs)}ms)`).toBeLessThan(
        3000,
      );
    }

    // Leaving mid-game (resign / close) works and returns to where it was opened from (Play).
    await page.getByRole('button', { name: contentText('play.close'), exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Play' })).toBeVisible();
  });
});

/**
 * Play's own "Full game" entry (M3.5, `PlayScreen`'s vs Computer card): a separate route to the
 * same versus UI `first-game` uses, picked by bot level (Mouse is unlocked once World 4 is
 * mastered). Seeds World 4 mastered the same way as the boss smoke test above, plus `first-game`'s
 * own `MiniGameProgress` win (the world boss, needed for World 4 to count as "mastered" at all —
 * `docs/domain-model.md` §3), then: starts a full game vs Mouse from Play, plays 3 kid moves with
 * fast bot replies, and leaves mid-game — recorded as `abandoned`, not a loss (`GameRecord`,
 * `docs/computer-opponent.md` §6).
 */
test.describe('Play -> vs Computer: full game (M3.5, seeded smoke test)', () => {
  test('starts a full game vs Mouse, plays 3 kid moves, and leaving mid-game records it abandoned', async ({
    page,
  }) => {
    const boss = findMiniGame('first-game');
    if (boss.mode !== 'versus') {
      throw new Error('first-game is expected to be a versus mini-game');
    }

    const orderedLessons = lessonsInJourneyOrder(catalog, content.lessons);
    const stalemateIndex = orderedLessons.findIndex((entry) => entry.id === 'stalemate');
    if (stalemateIndex < 0) {
      throw new Error('bundled content: "stalemate" lesson not found in journey order');
    }
    const before = orderedLessons.slice(0, stalemateIndex + 1);

    await completeFirstRun(page, 'Kid');
    await page.evaluate(() => {
      localStorage.setItem('chess-kids:test-seed', '20260924');
    });

    const profileId = await getSoleProfileId(page);
    await seedLessonsMastered(page, profileId, before);
    // `first-game` is World 4's own world boss: won (`MiniGameProgress`), on top of every lesson's
    // `bossStars`, before World 4 counts as "mastered" and so unlocks Mouse on the vs Computer card.
    await seedMiniGameWon(page, profileId, 'first-game');
    await page.reload();
    await expect(page.getByRole('heading', { name: "Who's playing today?" })).toBeVisible();
    await pickProfileFromPicker(page, 'Kid');

    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Play' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mouse, not played yet' })).toBeVisible();
    await page.getByRole('button', { name: 'Play a full game' }).click();

    await expect(page.getByText('Full Game vs Mouse')).toBeVisible();
    await expect(page.locator('[data-versus-status]')).toHaveAttribute(
      'data-versus-status',
      'playing',
    );

    for (let move = 0; move < 3; move += 1) {
      const start = Date.now();
      await playOneKidVersusMove(page, boss);
      await waitForVersusTurnOrEnd(page);
      const elapsedMs = Date.now() - start;
      expect(elapsedMs, `bot did not reply within 3s (took ${String(elapsedMs)}ms)`).toBeLessThan(
        3000,
      );
    }

    // Leave mid-game: the "Stop game?" confirm, then confirming records it as `abandoned`.
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByRole('alertdialog', { name: 'Stop this game?' })).toBeVisible();
    await page.getByRole('button', { name: 'Stop game' }).click();
    await expect(page.getByRole('heading', { name: 'Play' })).toBeVisible();

    const records = await page.evaluate(() => {
      const raw = localStorage.getItem('chess-kids:game-records');
      return raw ? (JSON.parse(raw) as { game: string; opponent: string; result: string }[]) : [];
    });
    const record = records.find((entry) => entry.game === 'full');
    expect(record).toMatchObject({ opponent: 'computer:1', result: 'abandoned' });
    // Still "not played yet" on the card: an abandoned game is not a win/loss tally.
    await expect(page.getByRole('button', { name: 'Mouse, not played yet' })).toBeVisible();
  });
});
