import type { Page } from '@playwright/test';
import { contentText } from './i18n.ts';

/**
 * Welcome → password → saved → new player (nickname, avatar), stopping right at the
 * "Already know some chess?" placement offer (domain-model.md §3.2) — shared by `completeFirstRun`
 * (declines it, same landing-on-Home contract every other spec relies on) and specs that exercise
 * placement itself.
 */
export async function completeFirstRunToPlacementOffer(
  page: Page,
  nickname = 'Kid',
): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start setup' }).click();

  await page.getByLabel('Parent code', { exact: true }).fill('1234');
  await page.getByLabel('Repeat parent code').fill('1234');
  await page.getByRole('button', { name: 'Save parent code' }).click();

  await page.getByRole('button', { name: 'Next' }).click(); // Saved -> new player
  await page.getByPlaceholder('Your name').fill(nickname);
  await page.getByRole('button', { name: 'Next' }).click(); // nickname -> avatar
  await page.getByRole('button', { name: "Let's play!" }).click();

  await page.getByText(contentText('placement.offer-question')).waitFor();
}

/**
 * Drives a fresh install through first run (Welcome → parent password → Saved → new player) up
 * to Home. Every Playwright test starts with empty browser storage, so specs that just need Home
 * or a lesson call this first instead of `page.goto('/')` directly (`profiles.spec.ts` is the one
 * spec that exercises first run's own screens in detail). `completeFirstRunToPlacementOffer`, then
 * declines placement ("No, start at World 1") — every spec that only needs a fresh profile on Home
 * keeps this same contract.
 */
export async function completeFirstRun(page: Page, nickname = 'Kid'): Promise<void> {
  await completeFirstRunToPlacementOffer(page, nickname);
  await page.getByRole('button', { name: contentText('placement.offer-no') }).click();
  await page.getByRole('heading', { level: 1, name: 'Chess for Kids' }).waitFor();
}

/**
 * Dismisses the badge celebration overlay if one is showing (a no-op otherwise) — lesson
 * complete, a game's result and the session summary can each now surface one, and its own
 * "Continue" button shares its text with that same screen's own primary button underneath, so
 * specs call this first to avoid an ambiguous match. Loops (bounded, celebrations cap at 2 per
 * app sitting) since dismissing one can immediately queue a second.
 */
export async function dismissCelebrationIfShown(page: Page): Promise<void> {
  const celebration = page.getByRole('alertdialog', { name: 'New badge!' });
  for (let i = 0; i < 2; i += 1) {
    if (!(await celebration.isVisible().catch(() => false))) return;
    await celebration.getByRole('button', { name: 'Continue' }).click();
  }
}

/**
 * From the profile picker (a parent lock already exists), taps the tile named `nickname` and
 * waits for Home. Every reload shows the picker again (app-structure.md §3), so specs that reload
 * mid-flow call this to get back to Home.
 */
export async function pickProfileFromPicker(page: Page, nickname: string): Promise<void> {
  await page.getByRole('button', { name: new RegExp(nickname) }).click();
  await page.getByRole('heading', { level: 1, name: 'Chess for Kids' }).waitFor();
}

/** From Home, opens today's lesson and advances Story -> Demo -> first guided try. */
export async function startLessonToFirstGuided(page: Page): Promise<void> {
  await completeFirstRun(page);
  await page.getByRole('button', { name: /Start/ }).click();
  await page.getByRole('button', { name: /Let me try/ }).click(); // Story -> Demo
  await page.getByRole('button', { name: /^Next/ }).click(); // Demo -> first guided try
}

/**
 * From the picker (a parent lock already set up, "Grown-ups" showing), opens the parent area with
 * the standard test password — every spec's own copy of this same flow collapses here
 * (`parent-area.spec.ts`, `device-sharing.spec.ts`, `test-fixtures/storage/generate-fixture.spec.ts`).
 */
export async function openParentArea(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Grown-ups/ }).click();
  await page.getByLabel('Parent code', { exact: true }).fill('1234');
  await page.getByRole('button', { name: 'Open' }).click();
  await page.getByRole('heading', { name: 'Parent area' }).waitFor();
}
