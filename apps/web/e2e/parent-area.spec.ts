import { expect, test } from '@playwright/test';
import {
  completeFirstRun,
  findLesson,
  getProfileIdByNickname,
  seedGameRecordWins,
  seedLessonMastered,
} from './helpers.ts';

/** From an already-rendered profile picker, opens the parent area with the standard test password. */
async function openParentArea(page: import('@playwright/test').Page): Promise<void> {
  await page.getByRole('button', { name: /Grown-ups/ }).click();
  await page.getByLabel('Parent code', { exact: true }).fill('1234');
  await page.getByRole('button', { name: 'Open' }).click();
  await page.getByRole('heading', { name: 'Parent area' }).waitFor();
}

test.describe('Parent area: overview, report, backup (M5.1)', () => {
  test('seed two children → overview → report shows seeded stars/games → export → reset → import the exported file → data back', async ({
    page,
  }) => {
    await completeFirstRun(page, 'Mia');

    // Switch player -> Grown-ups -> parent area -> Add child "Leo".
    await page.getByRole('button', { name: 'Switch player' }).click();
    await openParentArea(page);
    await page.getByRole('button', { name: 'Add child' }).click();
    await page.getByPlaceholder('Your name').fill('Leo');
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByText('Pick your animal!').waitFor();
    await page.getByRole('button', { name: "Let's play!" }).click();
    await page.getByRole('heading', { name: 'Parent area' }).waitFor();

    // Seed Mia's own progress + a game, directly into storage (same shape a real playthrough
    // writes) — Rook mastered (every exercise + boss at 3 stars) and one full-game win vs Mouse.
    const miaId = await getProfileIdByNickname(page, 'Mia');
    const rook = findLesson('rook');
    await seedLessonMastered(page, miaId, rook);
    await seedGameRecordWins(page, miaId, 1, 1);

    // Overview: both children show, Mia's own card already reflects her seeded stars.
    await page.reload();
    await openParentArea(page);
    await page.getByText('Leo', { exact: true }).waitFor();
    const miaCard = page.getByRole('button', { name: /^Mia/ });
    await expect(miaCard.getByText(/^[1-9]\d* stars$/)).toBeVisible();

    // Tapping it opens her report with the same seeded game showing, by name.
    await miaCard.click();
    await page.getByRole('button', { name: 'Settings' }).waitFor();
    await expect(page.getByText('Mouse')).toBeVisible(); // the seeded game's own row, by name

    // Settings: export this child's data (a real download).
    await page.getByRole('button', { name: 'Settings' }).click();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: "Export this child's data" }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^chess-kids-backup-mia-\d{4}-\d{2}-\d{2}\.json$/);
    const exportedPath = await download.path();
    if (!exportedPath) throw new Error('download had no local path');

    // Reset: wrong password rejected, right password clears progress (report now shows 0 stars).
    await page.getByRole('button', { name: 'Reset progress' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Parent code', { exact: true }).fill('nope');
    await dialog.getByRole('button', { name: 'Reset' }).click();
    await dialog.getByText('Wrong parent code.').waitFor();
    await dialog.getByLabel('Parent code', { exact: true }).fill('1234');
    await dialog.getByRole('button', { name: 'Reset' }).click();
    await page.getByText('Progress reset.').waitFor();

    await page.getByRole('button', { name: 'Back' }).click(); // settings -> report
    await page.getByRole('button', { name: 'Back' }).click(); // report -> overview
    await expect(miaCard.getByText('0 stars', { exact: true })).toBeVisible();

    // Backup: importing the earlier export restores Mia's reset-away progress.
    await page.getByRole('button', { name: 'Backup' }).click();
    await page.getByLabel('Choose file').setInputFiles(exportedPath);
    await page.getByText(/^1 child, [1-9]\d* stars$/).waitFor();
    await page.getByRole('button', { name: 'Replace all data' }).click();
    await page.getByText('Import complete.').waitFor();

    await page.getByRole('button', { name: 'Back' }).click(); // backup -> overview
    await expect(miaCard.getByText(/^[1-9]\d* stars$/)).toBeVisible();
  });
});

test.describe('Parent area: privacy (M5.5)', () => {
  test('the Privacy row opens the policy page, same text as the first-run link, version shown on the overview', async ({
    page,
  }) => {
    await completeFirstRun(page, 'Mia');
    await page.getByRole('button', { name: 'Switch player' }).click();
    await openParentArea(page);

    await page.getByText(/^Version \d+\.\d+\.\d+$/).waitFor();

    await page.getByRole('button', { name: 'Privacy' }).click();
    await page.getByRole('heading', { name: 'Privacy' }).waitFor();
    await expect(
      page.getByText('Chess for Kids keeps everything on this device.', { exact: false }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Back' }).click();
    await page.getByRole('heading', { name: 'Parent area' }).waitFor();
  });
});
