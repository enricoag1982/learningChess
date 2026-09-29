import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { completeFirstRun, openParentArea } from './kit.ts';

/** Picker -> Grown-ups -> the child's report -> Settings. */
async function openChildSettings(page: Page, nickname: string): Promise<void> {
  await openParentArea(page);
  await page.getByRole('button', { name: new RegExp(`^${nickname}`) }).click();
  await page.getByRole('button', { name: 'Settings' }).click();
}

test.describe('Parent area', () => {
  test('the daily limit set in a child Settings survives a reload', async ({ page }) => {
    await completeFirstRun(page, 'Mia');
    await page.getByRole('button', { name: 'Switch player' }).click();
    await openChildSettings(page, 'Mia');

    const everyDay = page.getByRole('group', { name: 'Every day' });
    await expect(everyDay.getByRole('button', { name: 'Off' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await everyDay.getByRole('button', { name: '30 min' }).click();
    await expect(everyDay.getByRole('button', { name: '30 min' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await page.reload();
    await page.getByRole('heading', { name: "Who's playing today?" }).waitFor();
    await openChildSettings(page, 'Mia');
    await expect(
      page.getByRole('group', { name: 'Every day' }).getByRole('button', { name: '30 min' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  test('every localStorage key belongs to the math app', async ({ page }) => {
    await completeFirstRun(page, 'Mia');
    await page.getByRole('button', { name: /Start/ }).click(); // opening a lesson writes progress too
    await page.getByRole('button', { name: /Let me try/ }).waitFor();

    const keys = await page.evaluate(() => Object.keys(localStorage));
    expect(keys.length).toBeGreaterThan(0);
    expect(keys.filter((key) => !key.startsWith('math-demo:'))).toEqual([]);
  });
});
