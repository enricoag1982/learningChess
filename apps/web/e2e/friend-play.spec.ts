import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { CompiledContent, TracksCatalog } from '@chess-kids/core';
import rawContent from '@chess-kids/content/content.json' with { type: 'json' };
import rawTracks from '@chess-kids/content/tracks.json' with { type: 'json' };
import {
  clickSquare,
  completeFirstRun,
  getProfileIdByNickname,
  getSoleProfileId,
  pickProfileFromPicker,
  seedWorldFourMastered,
} from './helpers.ts';

const content = rawContent as unknown as CompiledContent;
const catalog = rawTracks as unknown as TracksCatalog;

interface StoredGameRecord {
  readonly profileId: string;
  readonly game: string;
  readonly opponent: string;
  readonly result: string;
  readonly reason: string;
}

/** Every `GameRecord` in real storage for `profileId` (same shape `LocalStorageGameRecordRepository` writes). */
async function gameRecordsFor(page: Page, profileId: string): Promise<StoredGameRecord[]> {
  return page.evaluate((pid) => {
    const raw = localStorage.getItem('chess-kids:game-records');
    const all = raw ? (JSON.parse(raw) as StoredGameRecord[]) : [];
    return all.filter((record) => record.profileId === pid);
  }, profileId);
}

/** Adds a second profile ("Ben") from the parent area, without leaving Mia as the active player. */
async function addSecondProfile(page: Page, nickname: string): Promise<void> {
  await page.getByRole('button', { name: 'Switch player' }).click();
  await page.getByRole('button', { name: /Grown-ups/ }).click();
  await page.getByLabel('Parent code', { exact: true }).fill('1234');
  await page.getByRole('button', { name: 'Open' }).click();
  await expect(page.getByRole('heading', { name: 'Parent area' })).toBeVisible();

  await page.getByRole('button', { name: 'Add child' }).click();
  await page.getByPlaceholder('Your name').fill(nickname);
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: "Let's play!" }).click();
  await expect(page.getByRole('heading', { name: 'Parent area' })).toBeVisible();

  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('heading', { name: "Who's playing today?" })).toBeVisible();
}

test.describe('vs Friend (M4.3)', () => {
  test("full game, pass-and-play, Scholar's mate — names the winner, saves both profiles' records", async ({
    page,
  }) => {
    await completeFirstRun(page, 'Mia');
    const miaId = await getSoleProfileId(page);
    await seedWorldFourMastered(page, miaId, catalog, content.lessons);
    await page.reload();
    await pickProfileFromPicker(page, 'Mia');

    await addSecondProfile(page, 'Ben');
    const benId = await getProfileIdByNickname(page, 'Ben');
    await seedWorldFourMastered(page, benId, catalog, content.lessons);
    await page.reload();
    await pickProfileFromPicker(page, 'Mia');

    // Play → vs Friend → setup sheet: Ben, Full Game, pass-and-play (default legal-move dots and
    // colours — Mia plays White).
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await page.getByRole('button', { name: 'vs Friend' }).click();
    await expect(page.getByRole('heading', { name: 'vs Friend' })).toBeVisible();
    await page.getByRole('button', { name: 'Ben' }).click();
    await page.getByRole('button', { name: 'Full Game' }).click();
    await page.getByRole('button', { name: 'Pass and play' }).click();
    await page.getByRole('button', { name: 'Start' }).click();
    await page.getByRole('button', { name: /^e2,/ }).waitFor();

    // 1.e4 e5 2.Qh5 Nc6 3.Bc4 Nf6?? 4.Qxf7# (Scholar's mate), 4 moves each side, White (Mia) mates.
    // Both sides are played from this one screen (no bot), so each wait is for the move just made.
    await clickSquare(page, 'e2');
    await clickSquare(page, 'e4');
    await page.getByRole('button', { name: /^e4, white pawn/ }).waitFor();
    await clickSquare(page, 'e7');
    await clickSquare(page, 'e5');
    await page.getByRole('button', { name: /^e5, black pawn/ }).waitFor();
    await clickSquare(page, 'd1');
    await clickSquare(page, 'h5');
    await page.getByRole('button', { name: /^h5, white queen/ }).waitFor();
    await clickSquare(page, 'b8');
    await clickSquare(page, 'c6');
    await page.getByRole('button', { name: /^c6, black knight/ }).waitFor();
    await clickSquare(page, 'f1');
    await clickSquare(page, 'c4');
    await page.getByRole('button', { name: /^c4, white bishop/ }).waitFor();
    await clickSquare(page, 'g8');
    await clickSquare(page, 'f6');
    await page.getByRole('button', { name: /^f6, black knight/ }).waitFor();
    await clickSquare(page, 'h5');
    await clickSquare(page, 'f7');

    await expect(page.getByText('Mia wins!')).toBeVisible();

    await expect
      .poll(async () => (await gameRecordsFor(page, miaId)).some((r) => r.game === 'full'))
      .toBe(true);
    const miaRecords = await gameRecordsFor(page, miaId);
    const benRecords = await gameRecordsFor(page, benId);
    const miaRecord = miaRecords.find((r) => r.game === 'full');
    const benRecord = benRecords.find((r) => r.game === 'full');
    expect(miaRecord).toMatchObject({
      opponent: `profile:${benId}`,
      result: 'win',
      reason: 'checkmate',
    });
    expect(benRecord).toMatchObject({
      opponent: `profile:${miaId}`,
      result: 'loss',
      reason: 'checkmate',
    });

    await page.getByRole('button', { name: 'Back to Play' }).click();
    await expect(page.getByRole('heading', { name: 'Play' })).toBeVisible();
  });

  test('the board stays square (docs/screens.md §1) at tablet landscape, tablet portrait and phone', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await completeFirstRun(page, 'Mia');
    const miaId = await getSoleProfileId(page);
    await seedWorldFourMastered(page, miaId, catalog, content.lessons);
    await page.reload();
    await pickProfileFromPicker(page, 'Mia');

    // Face-to-face: two per-player strips of variable height flank the board, so its square size
    // can't come from a fixed viewport-tuned CSS cap (`GameLayout`'s own) the way a lesson/versus
    // board's does — this is exactly the shape that needs `SquareArea`'s own measurement.
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await page.getByRole('button', { name: 'vs Friend' }).click();
    await page.getByRole('button', { name: 'Guest' }).click();
    await page.getByRole('button', { name: 'Full Game' }).click();
    await page.getByRole('button', { name: 'Face to face' }).click();
    await page.getByRole('button', { name: 'Start' }).click();
    await page.getByRole('button', { name: /^e2,/ }).waitFor();

    async function expectSquareBoard(): Promise<void> {
      const box = await page.getByRole('grid', { name: 'Chess board' }).boundingBox();
      expect(box, 'no bounding box for the board').not.toBeNull();
      expect(
        Math.abs((box?.width ?? 0) - (box?.height ?? 0)),
        `board ${String(box?.width)}×${String(box?.height)} is not square`,
      ).toBeLessThanOrEqual(2);
    }

    await expectSquareBoard(); // 1024×768 (tablet landscape)

    await page.setViewportSize({ width: 768, height: 1024 });
    await expectSquareBoard(); // 768×1024 (tablet portrait) — same match, `ResizeObserver` reacts

    // Stop this face-to-face game, then start a fresh pass-and-play one at phone width.
    await page.getByRole('button', { name: 'Stop' }).first().click();
    await page.getByRole('alertdialog', { name: 'Stop this game?' }).waitFor();
    await page.getByRole('button', { name: 'Stop game' }).click();
    await page.getByRole('heading', { name: 'Play' }).waitFor();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'vs Friend' }).click();
    await page.getByRole('button', { name: 'Guest' }).click();
    await page.getByRole('button', { name: 'Full Game' }).click();
    await page.getByRole('button', { name: 'Pass and play' }).click();
    await page.getByRole('button', { name: 'Start' }).click();
    await page.getByRole('button', { name: /^e2,/ }).waitFor();
    await expectSquareBoard(); // 390×844 (phone)
  });
});
