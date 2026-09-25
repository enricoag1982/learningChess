import { expect, test } from '@playwright/test';
import {
  completeFirstRun,
  getSoleProfileId,
  pickProfileFromPicker,
  seedDailyLimit,
  seedMinutesToday,
} from './helpers.ts';

test.describe('Daily time limit (M5.2)', () => {
  test('Start today -> See you tomorrow -> parent password -> +15 min -> lesson starts', async ({
    page,
  }) => {
    await completeFirstRun(page, 'Kid');
    const profileId = await getSoleProfileId(page);

    // Seeded straight at the limit — no real waiting.
    await seedDailyLimit(page, profileId, 15);
    await seedMinutesToday(page, profileId, 15);

    await page.getByRole('button', { name: /Start today/ }).click();
    await page.getByRole('heading', { name: 'See you tomorrow!' }).waitFor();
    await expect(page.getByRole('button', { name: /Let me try/ })).toHaveCount(0);

    await page.getByRole('button', { name: 'Parent: more time' }).click();
    await page.getByLabel('Parent code', { exact: true }).fill('1234');
    await page.getByRole('button', { name: 'Open' }).click();

    // Resumes straight into the gated lesson — no confirmation screen in between.
    await page.getByRole('button', { name: /Let me try/ }).waitFor();
  });

  test('a wrong password at "Parent: more time" stays on the gate', async ({ page }) => {
    await completeFirstRun(page, 'Kid');
    const profileId = await getSoleProfileId(page);
    await seedDailyLimit(page, profileId, 15);
    await seedMinutesToday(page, profileId, 15);

    await page.getByRole('button', { name: /Start today/ }).click();
    await page.getByRole('heading', { name: 'See you tomorrow!' }).waitFor();

    await page.getByRole('button', { name: 'Parent: more time' }).click();
    await page.getByLabel('Parent code', { exact: true }).fill('nope');
    await page.getByRole('button', { name: 'Open' }).click();
    await page.getByText('Wrong code (1 of 5)').waitFor();
  });

  test('Switch player from "See you tomorrow" returns to the picker', async ({ page }) => {
    await completeFirstRun(page, 'Kid');
    const profileId = await getSoleProfileId(page);
    await seedDailyLimit(page, profileId, 15);
    await seedMinutesToday(page, profileId, 15);

    await page.getByRole('button', { name: /Start today/ }).click();
    await page.getByRole('heading', { name: 'See you tomorrow!' }).waitFor();

    await page.getByRole('button', { name: 'Switch player' }).click();
    await page.getByRole('heading', { name: "Who's playing today?" }).waitFor();
  });

  test('never interrupts a lesson already open, even once over the limit mid-lesson', async ({
    page,
  }) => {
    await completeFirstRun(page, 'Kid');
    const profileId = await getSoleProfileId(page);
    await seedDailyLimit(page, profileId, 15);
    await seedMinutesToday(page, profileId, 10); // under the limit: the lesson opens normally

    await page.getByRole('button', { name: /Start today/ }).click();
    await page.getByRole('button', { name: /Let me try/ }).waitFor(); // in the lesson's Story step

    await seedMinutesToday(page, profileId, 15); // time passes mid-lesson, now at the limit
    await page.getByRole('button', { name: /Let me try/ }).click(); // Story -> Demo
    await page.getByRole('button', { name: /^Next/ }).waitFor();
    await expect(page.getByRole('heading', { name: 'See you tomorrow!' })).toHaveCount(0);

    // Only leaving the lesson (returning to Home) re-checks the gate.
    await page.getByRole('button', { name: 'Close lesson' }).click();
    await page.getByRole('heading', { name: 'See you tomorrow!' }).waitFor();
  });

  test('the daily limit off (default) never gates any activity', async ({ page }) => {
    await completeFirstRun(page, 'Kid');
    const profileId = await getSoleProfileId(page);
    await seedMinutesToday(page, profileId, 999); // a lot of minutes, limit stays off

    await page.getByRole('button', { name: /Start today/ }).click();
    await page.getByRole('button', { name: /Let me try/ }).waitFor();
  });

  test('a parent-set limit shows its line on the minutes-per-day chart', async ({ page }) => {
    await completeFirstRun(page, 'Kid');
    const profileId = await getSoleProfileId(page);
    await seedDailyLimit(page, profileId, 30);
    await seedMinutesToday(page, profileId, 12);

    await page.reload();
    await pickProfileFromPicker(page, 'Kid');
    await page.getByRole('button', { name: 'Switch player' }).click();
    await page.getByRole('button', { name: /Grown-ups/ }).click();
    await page.getByLabel('Parent code', { exact: true }).fill('1234');
    await page.getByRole('button', { name: 'Open' }).click();
    await page.getByRole('button', { name: /^Kid/ }).click();
    await page.getByRole('button', { name: 'Settings' }).waitFor();

    await expect(page.getByText('Daily limit: 30 min')).toBeVisible();
  });
});
