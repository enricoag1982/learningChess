import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { completeFirstRun, openParentArea } from './kit.ts';

/** The parsed contents of a saved backup file. */
function readBackup(path: string): object {
  const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
  if (typeof parsed !== 'object' || parsed === null) throw new Error('backup is not a JSON object');
  return parsed;
}

test.describe('Backup', () => {
  test('exports carry the math app id; importing one back merges; a chess file is rejected', async ({
    page,
  }) => {
    // Playwright drives no OS share sheet: without navigator.share, "Send to other device" downloads.
    await page.addInitScript(() => {
      Object.defineProperty(window.navigator, 'share', { value: undefined, configurable: true });
      Object.defineProperty(window.navigator, 'canShare', { value: undefined, configurable: true });
    });
    await completeFirstRun(page, 'Mia');
    await page.getByRole('button', { name: 'Switch player' }).click();
    await openParentArea(page);
    await page.getByRole('button', { name: 'Backup' }).click();

    const [exported] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export all' }).click(),
    ]);
    expect(exported.suggestedFilename()).toMatch(/^math-demo-backup-\d{4}-\d{2}-\d{2}\.json$/);
    const exportedPath = await exported.path();
    expect(readBackup(exportedPath)).toMatchObject({ app: 'math-demo' });

    const [shared] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Send to other device' }).click(),
    ]);
    expect(shared.suggestedFilename()).toMatch(/^math-demo-all-\d{4}-\d{2}-\d{2}\.json$/);
    expect(readBackup(await shared.path())).toMatchObject({ app: 'math-demo' });

    // The same device's own file: the child is recognised, so it merges with no choice to make.
    await page.getByLabel('Choose file').setInputFiles(exportedPath);
    await page.getByText(/^1 child$/).waitFor();
    await page.getByText('Merging into Mia').waitFor();
    await page.getByRole('button', { name: 'Merge' }).click();
    await page.getByText('Import complete.').waitFor();

    // A file made by the chess app is not this app's backup.
    const chessFile = { ...readBackup(exportedPath), app: 'chess-kids' };
    await page.getByLabel('Choose file').setInputFiles({
      name: 'chess-kids-backup.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(chessFile)),
    });
    await page.getByText('Not a valid backup file.').waitFor();
    await expect(page.getByRole('button', { name: 'Merge' })).toHaveCount(0);
  });
});
