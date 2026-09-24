import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  completeFirstRun,
  findLesson,
  findMiniGame,
  getSoleProfileId,
  pickProfileFromPicker,
  playOneKidVersusMove,
  playSolveLine,
  seedGameRecordWins,
  seedLessonMastered,
  waitForVersusTurnOrEnd,
} from './helpers.ts';

/** The `hungry-rook` mini-game's own `MiniGameProgress` record, straight from real storage. */
async function readHungryRookProgress(
  page: Page,
  profileId: string,
): Promise<
  { readonly plays: number; readonly wins: number; readonly bestStars: number } | undefined
> {
  return page.evaluate((pid) => {
    const raw = localStorage.getItem('chess-kids:minigame-progress');
    const all = raw
      ? (JSON.parse(raw) as Record<
          string,
          { readonly plays: number; readonly wins: number; readonly bestStars: number }
        >)
      : {};
    return all[`${pid}:hungry-rook`];
  }, profileId);
}

test.describe('Play screen and My Den', () => {
  test('solving an unlocked mini-game standalone saves stars, shown on the Play tile and My Den', async ({
    page,
  }) => {
    const rook = findLesson('rook');
    const hungryRook = findMiniGame('hungry-rook');
    if (hungryRook.mode !== 'static')
      throw new Error('hungry-rook is expected to be a static mini-game');

    await completeFirstRun(page, 'Kid');
    const profileId = await getSoleProfileId(page);
    await seedLessonMastered(page, profileId, rook);
    await page.reload();
    await expect(page.getByRole('heading', { name: "Who's playing today?" })).toBeVisible();
    await pickProfileFromPicker(page, 'Kid');

    // Home -> Play: Hungry Rook is unlocked (the Rook lesson is mastered).
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Play' })).toBeVisible();
    const tile = page.getByRole('button', { name: /^Hungry Rook,/ });
    await expect(tile).toBeVisible();

    // Open it standalone, solve it, and go back to Play.
    await tile.click();
    await expect(page.getByRole('heading', { name: 'Hungry Rook' })).toBeVisible();
    await playSolveLine(page, hungryRook.position, 'capture');
    await page.getByRole('button', { name: /Back to Play/ }).click();

    await expect(page.getByRole('heading', { name: 'Play' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Hungry Rook, 3 stars' })).toBeVisible();

    const progress = await readHungryRookProgress(page, profileId);
    expect(progress?.plays).toBe(1);
    expect(progress?.wins).toBe(1);
    expect(progress?.bestStars).toBe(3);

    // Back to Home, then My Den: Rhino is now a friend, and the rank is still Pawn (only the
    // Rook lesson is mastered — World 2 as a whole is not).
    await page.getByRole('button', { name: 'Back to Home' }).click();
    await page.getByRole('button', { name: 'My Den' }).click();
    await expect(page.getByText("Kid's Den")).toBeVisible();
    await expect(page.getByRole('listitem', { name: 'Rhino, friend' })).toBeVisible();
    await expect(page.getByRole('listitem', { name: 'Pawn, You are here' })).toBeVisible();
  });
});

/**
 * Play -> vs Computer: Fox playable (M4.2, `docs/computer-opponent.md` §3): Fox unlocks with 3
 * full-game wins vs Rabbit (`computerLevelStatus`, `opponent: computer:2`), seeded directly —
 * unlike Mouse/Rabbit this needs no World mastery at all. A seeded bot keeps every reply fast and
 * deterministic (`world4.spec.ts`'s pattern); `first-game`'s own position/rules stand in for the
 * runtime-built "full game vs Fox" (same standard start, same real check rules).
 */
test.describe('Play -> vs Computer: Fox unlocked (M4.2, seeded smoke test)', () => {
  test('starts a full game vs Fox, plays 2 kid moves with fast bot replies, and can be left mid-game', async ({
    page,
  }) => {
    const boss = findMiniGame('first-game');
    if (boss.mode !== 'versus') {
      throw new Error('first-game is expected to be a versus mini-game');
    }

    await completeFirstRun(page, 'Kid');
    await page.evaluate(() => {
      localStorage.setItem('chess-kids:test-seed', '20260924');
    });

    const profileId = await getSoleProfileId(page);
    // 3 full-game wins vs Rabbit unlock Fox directly (no World mastery needed for this check).
    await seedGameRecordWins(page, profileId, 2, 3);
    await page.reload();
    await expect(page.getByRole('heading', { name: "Who's playing today?" })).toBeVisible();
    await pickProfileFromPicker(page, 'Kid');

    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Play' })).toBeVisible();
    // No games recorded directly against Fox itself (only vs Rabbit, to unlock it).
    await page.getByRole('button', { name: 'Fox, not played yet' }).click();
    await page.getByRole('button', { name: 'Play a full game' }).click();

    await expect(page.getByText('Full Game vs Fox')).toBeVisible();
    await expect(page.locator('[data-versus-status]')).toHaveAttribute(
      'data-versus-status',
      'playing',
    );

    for (let move = 0; move < 2; move += 1) {
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
    const record = records.find(
      (entry) => entry.game === 'full' && entry.opponent === 'computer:3',
    );
    expect(record).toMatchObject({ result: 'abandoned' });
  });
});
