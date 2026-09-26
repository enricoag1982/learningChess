// Snapshot rule (docs/refactor-v4.md R0 "storage-compat fixtures"): this spec's own expectations
// change ONLY when the storage/backup format or these screens' contracts change on purpose — a v4
// refactor PR must leave it green, unmodified, against every fixture tag.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { findLesson, journeyNodeName } from './helpers.ts';

const FIXTURES_DIR = join(import.meta.dirname, '..', 'test-fixtures', 'storage');
const TAGS = ['v1.0.0', 'v1.1.0', 'v2.0.0'] as const;
/** Every fixture's own parent code (`test-fixtures/storage/README.md`), test data only. */
const PARENT_CODE = '1234';

for (const tag of TAGS) {
  test(`storage compat smoke: ${tag} fixture loads on the current app`, async ({ page }) => {
    test.setTimeout(20_000);

    const dump = JSON.parse(
      readFileSync(join(FIXTURES_DIR, tag, 'local-storage.json'), 'utf8'),
    ) as Record<string, string>;
    // The dump already carries `chess-kids:schema-version` (every fixture's own key list,
    // `local-store.ts`'s reserved-prefix guard) — filled before the very first `goto`, same as the
    // app's own storage would already hold it on a returning device.
    expect(Object.keys(dump)).toContain('chess-kids:schema-version');

    await page.addInitScript((entries: readonly (readonly [string, string])[]) => {
      for (const [key, value] of entries) {
        window.localStorage.setItem(key, value);
      }
    }, Object.entries(dump));

    await page.goto('/');

    // Picker shows both fixture children — no error screen (a `StorageError` would show one
    // instead of the picker).
    await expect(page.getByRole('heading', { name: "Who's playing today?" })).toBeVisible();
    await expect(page.getByRole('button', { name: /Mia/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Leo/ })).toBeVisible();

    // Pick Mia -> Home shows her Continue (she has one lesson left mid-way, `resumeStep > 0`) and
    // her stars pill above zero (3 lessons mastered for real, per the fixture).
    await page.getByRole('button', { name: /Mia/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Chess for Kids' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Continue/ })).toBeVisible();
    const starsPill = page.locator('[aria-label$=" stars"]');
    await expect(starsPill).toHaveAttribute('aria-label', /^(?!0 stars$).+/);

    // Journey: the fixture's own in-progress lesson (World 2's Rook) shows as her current lesson —
    // only true once World 1's 3 lessons the fixture completed are recognised as mastered.
    await page.getByRole('button', { name: /Journey/ }).click();
    const rook = findLesson('rook');
    await expect(
      page.getByRole('button', { name: journeyNodeName(rook, 'current') }),
    ).toBeVisible();

    // Parent area opens with the fixture's own parent code.
    await page.getByRole('button', { name: 'Back to Home' }).click();
    await page.getByRole('button', { name: 'Switch player' }).click();
    await page.getByRole('button', { name: /Grown-ups/ }).click();
    await page.getByLabel('Parent code', { exact: true }).fill(PARENT_CODE);
    await page.getByRole('button', { name: 'Open' }).click();
    await expect(page.getByRole('heading', { name: 'Parent area' })).toBeVisible();
  });
}
