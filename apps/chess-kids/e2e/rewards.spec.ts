import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {
  completeExercise,
  completeFirstRun,
  contentText,
  findLesson,
  getSoleProfileId,
  pickProfileFromPicker,
  seedLessonMastered,
} from './helpers.ts';

/** Fails on `serious` / `critical` axe-core violations (non-functional.md §2: WCAG 2.2 AA). */
async function expectNoSeriousViolations(page: Page, screen: string): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter(
    (violation) => violation.impact === 'serious' || violation.impact === 'critical',
  );
  expect(serious, `${screen}: ${JSON.stringify(serious, null, 2)}`).toEqual([]);
}

/** Escapes regex metacharacters so `text` can be embedded literally in a `RegExp` source. */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// M4.4: badges, streak, session log. "Perfect Lesson" (bronze, rewards.md §3: 3 stars on every
// exercise, 1 lesson) is evaluated after every scored exercise completion (`checkRewards`, app
// layer), never automatically — so seeding the "3 stars on every exercise" fact straight into
// storage (`seedLessonMastered`, near-threshold: the fact is already true, but no `EarnedBadge` row
// exists yet) and then finishing one more scored exercise for real is what actually earns it. Every
// authored lesson has >= 5 scored exercises, so "squares" (World 1, order 1 — the very first lesson,
// no lesson before it to also seed, no boss) is entered fresh from its own story and replayed
// through to its last exercise, deterministic and short (2 guided tries + 5 exercises, all
// yes-no/select-squares — no board-solver needed).
test('near-threshold Perfect Lesson: finishing the last exercise celebrates it and My Den shows it', async ({
  page,
}) => {
  const squares = findLesson('squares');

  await completeFirstRun(page, 'Kid');
  const profileId = await getSoleProfileId(page);
  await seedLessonMastered(page, profileId, squares);

  await page.reload();
  await expect(page.getByRole('heading', { name: "Who's playing today?" })).toBeVisible();
  await pickProfileFromPicker(page, 'Kid');

  // A mastered lesson is no longer the Journey's "next step" (Home's Start/Continue would move on
  // to the lesson after it), so re-enter it explicitly via the Journey; a mastered lesson restarts
  // at the story on re-entry (`enterLesson`). `lessonOrigin: 'journey'` also means its own Complete
  // step's Continue returns straight to the Journey, skipping the Today session machinery entirely.
  await page.getByRole('button', { name: /Journey/ }).click();
  await page
    .getByRole('button', { name: new RegExp(`^${escapeRegExp(contentText(squares.titleKey))},`) })
    .click();
  await page.getByRole('button', { name: /Let me try/ }).click(); // Story -> Demo
  await page.getByRole('button', { name: /^Next/ }).click(); // Demo -> first guided try

  for (const guided of squares.guided) {
    await completeExercise(page, guided);
  }
  for (const exercise of squares.exercises) {
    await completeExercise(page, exercise);
  }

  // Lesson complete: the celebration (rewards.md §4 "lesson complete" moment) shows automatically,
  // on top of (not instead of) the Complete step already underneath it.
  await expect(page.getByText('Lesson complete!')).toBeVisible();
  const celebration = page.getByRole('alertdialog', { name: 'New badge!' });
  await expect(celebration).toBeVisible();
  await expect(celebration.getByText('Perfect Lesson', { exact: true })).toBeVisible();
  await expectNoSeriousViolations(page, 'Celebration (Perfect Lesson)');

  await celebration.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);

  // Back to the lesson's own Complete step: continuing from here returns to the Journey.
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: /Back to Home/ }).click();

  await page.getByRole('button', { name: 'My Den', exact: true }).click();
  await expect(page.getByText("Kid's Den")).toBeVisible();
  // Dismissing its celebration already marked it seen (rewards.md §1), so no "new" dot here —
  // `DenScreen.test.tsx` covers the dot's own appear/tap-to-clear cycle for a badge earned without
  // ever showing a celebration (e.g. past this session's 2-celebration cap).
  const badgeTile = page.getByRole('button', { name: /^Perfect Lesson, .* tier, earned$/ });
  await expect(badgeTile).toBeVisible();
  await expectNoSeriousViolations(page, 'My Den (with an earned badge)');
});
