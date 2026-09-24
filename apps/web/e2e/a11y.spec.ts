import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {
  clickSquare,
  completeBoss,
  completeExercise,
  completeFirstRun,
  findLesson,
  findMiniGame,
  selectSquaresAnswer,
} from './helpers.ts';

/** Fails on `serious` / `critical` axe-core violations (non-functional.md §2: WCAG 2.2 AA). */
async function expectNoSeriousViolations(page: Page, screen: string): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter(
    (violation) => violation.impact === 'serious' || violation.impact === 'critical',
  );
  expect(serious, `${screen}: ${JSON.stringify(serious, null, 2)}`).toEqual([]);
}

/** Kid touch targets must be >= 64px both ways (docs/screens.md §1). */
async function expectKidTouchTarget(page: Page, name: RegExp | string): Promise<void> {
  const box = await page.getByRole('button', { name }).boundingBox();
  expect(box, `no bounding box for button matching ${String(name)}`).not.toBeNull();
  expect(box?.width ?? 0, `${String(name)} width`).toBeGreaterThanOrEqual(64);
  expect(box?.height ?? 0, `${String(name)} height`).toBeGreaterThanOrEqual(64);
}

/** Parent-area touch targets must be >= 44px both ways (docs/screens.md §1). */
async function expectParentTouchTarget(page: Page, name: RegExp | string): Promise<void> {
  const box = await page.getByRole('button', { name }).boundingBox();
  expect(box, `no bounding box for button matching ${String(name)}`).not.toBeNull();
  expect(box?.width ?? 0, `${String(name)} width`).toBeGreaterThanOrEqual(44);
  expect(box?.height ?? 0, `${String(name)} height`).toBeGreaterThanOrEqual(44);
}

test('onboarding and profile screens have no serious/critical violations and correctly sized touch targets', async ({
  page,
}) => {
  // 1. First run: Welcome (kid style).
  await page.goto('/');
  await expectKidTouchTarget(page, 'Start setup');
  await expectNoSeriousViolations(page, 'First run: Welcome');

  // 2. First run: parent password (parent style).
  await page.getByRole('button', { name: 'Start setup' }).click();
  await expectParentTouchTarget(page, 'Save password');
  await expectNoSeriousViolations(page, 'First run: Password');

  await page.getByLabel('Password', { exact: true }).fill('1234');
  await page.getByLabel('Repeat password').fill('1234');
  await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Save password' }).click(),
  ]);

  // 3. First run: Saved (parent style).
  await expectParentTouchTarget(page, 'Next');
  await expectNoSeriousViolations(page, 'First run: Saved');
  await page.getByRole('button', { name: 'Next' }).click();

  // 4. New player: nickname (kid style).
  await expectKidTouchTarget(page, 'Next');
  await expectNoSeriousViolations(page, 'New player: nickname');
  await page.getByPlaceholder('Your name').fill('Mia');
  await page.getByRole('button', { name: 'Next' }).click();

  // 5. New player: avatar (kid style).
  await expectKidTouchTarget(page, 'Fox');
  await expectKidTouchTarget(page, "Let's play!");
  await expectNoSeriousViolations(page, 'New player: avatar');
  await page.getByRole('button', { name: "Let's play!" }).click();

  // 6. Home's switch-player button, then the picker (kid style).
  await expectKidTouchTarget(page, 'Switch player');
  await page.getByRole('button', { name: 'Switch player' }).click();
  await expectKidTouchTarget(page, 'Mia');
  await expectKidTouchTarget(page, /Grown-ups/);
  await expectNoSeriousViolations(page, 'Picker');

  // 7. Password screen (parent style).
  await page.getByRole('button', { name: /Grown-ups/ }).click();
  await expectParentTouchTarget(page, 'Open');
  await expectNoSeriousViolations(page, 'Password screen');

  // 8. Parent area (parent style).
  await page.getByLabel('Password', { exact: true }).fill('1234');
  await page.getByRole('button', { name: 'Open' }).click();
  await expectParentTouchTarget(page, 'Add child');
  await expectParentTouchTarget(page, 'Rename');
  await expectNoSeriousViolations(page, 'Parent area');
});

test('lesson flow has no serious/critical accessibility violations and kid-sized touch targets', async ({
  page,
}) => {
  const lesson = findLesson('rook');
  const boss = findMiniGame(lesson.boss ?? '');

  // 1. Home.
  await completeFirstRun(page);
  await expectKidTouchTarget(page, /Start/);
  await expectKidTouchTarget(page, /Journey/);
  await expectNoSeriousViolations(page, 'Home');

  // 1b. Journey map, then back to Home.
  await page.getByRole('button', { name: /Journey/ }).click();
  await expectKidTouchTarget(page, /Back to Home/);
  await expectKidTouchTarget(page, /Rhino the Rook/);
  await expectNoSeriousViolations(page, 'Journey');
  await page.getByRole('button', { name: /Back to Home/ }).click();

  // 2. Story.
  await page.getByRole('button', { name: /Start/ }).click();
  await expectKidTouchTarget(page, 'Close lesson');
  await expectKidTouchTarget(page, /Listen again/);
  await expectKidTouchTarget(page, /Let me try/);
  await expectNoSeriousViolations(page, 'Story');

  // 3. Demo.
  await page.getByRole('button', { name: /Let me try/ }).click();
  await expectKidTouchTarget(page, /^Next/);
  await expectNoSeriousViolations(page, 'Demo');
  await page.getByRole('button', { name: /^Next/ }).click();

  // 4. Guided tries (not scanned individually; part of "an exercise" below).
  for (const guided of lesson.guided) {
    await expectKidTouchTarget(page, /Hint/);
    await expectKidTouchTarget(page, /Undo/);
    await completeExercise(page, guided);
  }

  // 5. An exercise (first scored one): full scan with the instruction/hint UI on screen.
  const [first, second, third, ...rest] = lesson.exercises;
  if (!first || !second || third?.type !== 'select-squares') {
    throw new Error('rook lesson fixture shape changed: expected exercise 3 to be select-squares');
  }
  await expectKidTouchTarget(page, /Hint/);
  await expectKidTouchTarget(page, /Undo/);
  await expectKidTouchTarget(page, /Say it again/);
  // With a hint note under the instruction the panel is at its tallest: targets must not shrink.
  await page.getByRole('button', { name: /Hint/ }).click();
  await expectKidTouchTarget(page, /Say it again/);
  await expectKidTouchTarget(page, /Hint/);
  await expectNoSeriousViolations(page, 'Exercise');
  await completeExercise(page, first);
  await completeExercise(page, second);

  // 6. Select-squares, including a wrong pick (orange note, never red — non-functional.md §2).
  await clickSquare(page, 'e5'); // not a legal rook move from d4: a wrong pick
  await expectKidTouchTarget(page, /Check/);
  await page.getByRole('button', { name: /Check/ }).click();
  await expect(page.getByText('Not quite! Look at the orange squares.')).toBeVisible();
  await expectNoSeriousViolations(page, 'Select-squares (wrong)');
  await clickSquare(page, 'e5'); // deselect the wrong pick
  for (const square of selectSquaresAnswer(third)) {
    await clickSquare(page, square);
  }
  await page.getByRole('button', { name: /Check/ }).click();
  await page.getByRole('button', { name: /^Next/ }).click();

  for (const exercise of rest) {
    await completeExercise(page, exercise);
  }

  // 7. Boss.
  await expectNoSeriousViolations(page, 'Boss');
  await completeBoss(page, boss);

  // 8. Complete.
  await expect(page.getByText('Lesson complete!')).toBeVisible();
  await expectKidTouchTarget(page, /Play again/);
  await expectKidTouchTarget(page, /Continue/);
  await expectNoSeriousViolations(page, 'Complete');
});
