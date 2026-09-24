import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {
  clickSquare,
  completeBoss,
  completeExercise,
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

test('lesson flow has no serious/critical accessibility violations and kid-sized touch targets', async ({
  page,
}) => {
  const lesson = findLesson('rook');
  const boss = findMiniGame(lesson.boss ?? '');

  // 1. Home.
  await page.goto('/');
  await expectKidTouchTarget(page, /Start/);
  await expectNoSeriousViolations(page, 'Home');

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
