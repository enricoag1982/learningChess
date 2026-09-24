import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  completeFirstRun,
  findLesson,
  findMiniGame,
  getSoleProfileId,
  pickProfileFromPicker,
  playSolveLine,
  seedLessonMastered,
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
