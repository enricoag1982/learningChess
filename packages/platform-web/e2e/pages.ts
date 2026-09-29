import type { Page } from '@playwright/test';
import type { E2ETexts } from './i18n.ts';

export interface PageFlows {
  completeFirstRunToPlacementOffer: (page: Page, nickname?: string) => Promise<void>;
  completeFirstRun: (page: Page, nickname?: string) => Promise<void>;
  dismissCelebrationIfShown: (page: Page) => Promise<void>;
  pickProfileFromPicker: (page: Page, nickname: string) => Promise<void>;
  startLessonToFirstGuided: (page: Page) => Promise<void>;
  openParentArea: (page: Page) => Promise<void>;
}

export interface PageFlowOptions {
  /** The app's Home heading, awaited after first run and after picking a profile. */
  readonly appTitle: string;
  readonly texts: Pick<E2ETexts, 'contentText'>;
}

/** The subject-neutral page flows (first run, picker, celebration, parent area), bound to one app. */
export function createPages({ appTitle, texts }: PageFlowOptions): PageFlows {
  const { contentText } = texts;
  const waitForHome = (page: Page): Promise<void> =>
    page.getByRole('heading', { level: 1, name: appTitle }).waitFor();

  // Stops at the placement offer, so specs that exercise placement can continue from there.
  async function completeFirstRunToPlacementOffer(page: Page, nickname = 'Kid'): Promise<void> {
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

  // Fresh install to Home, declining placement: the landing every spec that needs a profile relies on.
  async function completeFirstRun(page: Page, nickname = 'Kid'): Promise<void> {
    await completeFirstRunToPlacementOffer(page, nickname);
    await page.getByRole('button', { name: contentText('placement.offer-no') }).click();
    await waitForHome(page);
  }

  // A no-op without an overlay; loops because dismissing one can queue a second (at most 2 per sitting).
  async function dismissCelebrationIfShown(page: Page): Promise<void> {
    const celebration = page.getByRole('alertdialog', { name: 'New badge!' });
    for (let i = 0; i < 2; i += 1) {
      if (!(await celebration.isVisible().catch(() => false))) return;
      await celebration.getByRole('button', { name: 'Continue' }).click();
    }
  }

  // Every reload shows the picker again, so specs that reload call this to get back to Home.
  async function pickProfileFromPicker(page: Page, nickname: string): Promise<void> {
    await page.getByRole('button', { name: new RegExp(nickname) }).click();
    await waitForHome(page);
  }

  // From a fresh install: today's lesson, Story -> Demo -> first guided try.
  async function startLessonToFirstGuided(page: Page): Promise<void> {
    await completeFirstRun(page);
    await page.getByRole('button', { name: /Start/ }).click();
    await page.getByRole('button', { name: /Let me try/ }).click(); // Story -> Demo
    await page.getByRole('button', { name: /^Next/ }).click(); // Demo -> first guided try
  }

  // From the picker with a parent lock set: opens the parent area with the standard test code.
  async function openParentArea(page: Page): Promise<void> {
    await page.getByRole('button', { name: /Grown-ups/ }).click();
    await page.getByLabel('Parent code', { exact: true }).fill('1234');
    await page.getByRole('button', { name: 'Open' }).click();
    await page.getByRole('heading', { name: 'Parent area' }).waitFor();
  }

  return {
    completeFirstRunToPlacementOffer,
    completeFirstRun,
    dismissCelebrationIfShown,
    pickProfileFromPicker,
    startLessonToFirstGuided,
    openParentArea,
  };
}
