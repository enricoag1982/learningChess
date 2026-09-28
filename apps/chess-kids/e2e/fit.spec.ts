import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { TracksCatalog } from '@learn/platform-core';
import type { CompiledContent } from '@learn/subject-chess';
import { SQUARES } from '@learn/subject-chess';
import rawContent from '@learn/subject-chess/dist/content.json' with { type: 'json' };
import rawTracks from '@learn/subject-chess/dist/tracks.json' with { type: 'json' };
import {
  clickSquare,
  completeExercise,
  completeFirstRun,
  contentText,
  findLesson,
  findMiniGame,
  getSoleProfileId,
  lessonsInJourneyOrder,
  pickProfileFromPicker,
  playSolveLine,
  seedLessonMastered,
  seedLessonsMastered,
  selectSquaresAnswer,
  solveExercise,
} from './helpers.ts';

const content = rawContent as unknown as CompiledContent;
const catalog = rawTracks as unknown as TracksCatalog;

/**
 * Owner report (iPad mini 4, iOS 15.8 Safari, 2026-09-26): "the page is slightly bigger than the
 * screen and we always need to move the page up to go to Next". Causes: `vh` / `min-h-screen` (iOS
 * Safari's `vh` is the toolbar-hidden height) and a fixed `42–46vh` board cap that a tall panel
 * (long instruction, note, piece tray, boss counters) pushed past the screen. Now the board fills
 * what the panel leaves (`GameLayout.tsx`'s `FitSquare`).
 *
 * Chromium has no toolbar quirk, so this emulates the device's VISIBLE area as the viewport
 * (`playwright.config.ts`: 768x900, 1024x660, phone 390x844) and asserts `main` never scrolls and
 * Check / Next is fully on screen. The `choice` case plays the curriculum's longest instruction
 * (trades-05) with its 3 option buttons: the tallest panel.
 */

/** The lesson `main` (`h-dvh`, `overflow-y-auto`) must never need scrolling to reach its own
 * content — a scrollable `main` is exactly the "move the page up" symptom the owner reported. */
async function expectMainFits(page: Page, label: string): Promise<void> {
  const overflow = await page.locator('main').evaluate((el) => el.scrollHeight - el.clientHeight);
  expect(
    overflow,
    `${label}: main scrolls (scrollHeight - clientHeight = ${String(overflow)})`,
  ).toBeLessThanOrEqual(1);
}

/** The primary button (Check / Next) must be fully visible without scrolling — the other half of
 * the owner's report ("we always need to move the page up to go to Next"). */
async function expectButtonInViewport(
  page: Page,
  name: RegExp | string,
  label: string,
): Promise<void> {
  const viewport = page.viewportSize();
  if (!viewport) throw new Error(`${label}: no viewport size set`);
  const box = await page.getByRole('button', { name }).boundingBox();
  expect(box, `${label}: no bounding box for button matching ${String(name)}`).not.toBeNull();
  if (!box) return;
  expect(box.y, `${label}: button top above viewport`).toBeGreaterThanOrEqual(0);
  expect(box.x, `${label}: button left outside viewport`).toBeGreaterThanOrEqual(0);
  expect(
    box.y + box.height,
    `${label}: button bottom (${String(box.y + box.height)}) past viewport height (${String(viewport.height)})`,
  ).toBeLessThanOrEqual(viewport.height + 1);
  expect(
    box.x + box.width,
    `${label}: button right past viewport width (${String(viewport.width)})`,
  ).toBeLessThanOrEqual(viewport.width + 1);
}

/** Both halves of the fit condition together, for one on-screen state. */
async function expectFits(page: Page, buttonName: RegExp | string, label: string): Promise<void> {
  await expectMainFits(page, label);
  await expectButtonInViewport(page, buttonName, label);
}

/** Skips Story -> Demo -> Try (every guided try) -> first scored exercise, same 3-click sequence
 * `lesson.spec.ts`'s own Skip test uses (playtest 2's `skipPhase`). Assumes Home's Start/Continue
 * was already tapped. */
async function skipToFirstExercise(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Skip' }).click(); // Story -> Demo
  await page.getByRole('button', { name: 'Skip' }).click(); // Demo -> Try
  await page.getByRole('button', { name: 'Skip' }).click(); // Try -> Exercises
}

test('Demo step: board and Next button fit the viewport', async ({ page }) => {
  await completeFirstRun(page, 'Kid');
  await page.getByRole('button', { name: /Start/ }).click(); // Home -> Story
  await page.getByRole('button', { name: /Let me try/ }).click(); // Story -> Demo
  await expectFits(page, /^Next/, 'Demo step');
});

test('select-squares exercise: wrong-check note fits, solved (stars + Next) fits', async ({
  page,
}) => {
  const squares = findLesson('squares');
  const lines = findLesson('lines');
  const exercise = lines.exercises[0];
  if (!exercise || exercise.type !== 'select-squares') {
    throw new Error('lines-01 is expected to be a select-squares exercise');
  }

  await completeFirstRun(page, 'Kid');
  const profileId = await getSoleProfileId(page);
  await seedLessonMastered(page, profileId, squares); // unlocks "lines" as the current lesson

  await page.reload();
  await pickProfileFromPicker(page, 'Kid');
  await page.getByRole('button', { name: /Start|Continue/ }).click(); // Home -> Story (lines)
  await skipToFirstExercise(page);
  await expect(page.getByText(contentText(exercise.textKey))).toBeVisible();

  const answer = new Set(selectSquaresAnswer(exercise));
  const wrongSquare = SQUARES.find((square) => !answer.has(square));
  if (!wrongSquare) throw new Error('lines-01: every square is a correct answer');

  await clickSquare(page, wrongSquare);
  await page.getByRole('button', { name: /Check/ }).click();
  await expect(page.getByText(contentText('exercise.select-both'))).toBeVisible();
  await expectFits(page, /Check/, 'select-squares (wrong-check note)');

  await clickSquare(page, wrongSquare); // deselect the wrong pick before solving for real
  for (const square of answer) {
    await clickSquare(page, square);
  }
  await page.getByRole('button', { name: /Check/ }).click();
  await expectFits(page, /^Next/, 'select-squares (solved)');
});

test('move exercise (collect-stars): board and solved Next button fit', async ({ page }) => {
  const squares = findLesson('squares');
  const lines = findLesson('lines');
  const setup = findLesson('setup');
  const rook = findLesson('rook');
  const exercise = rook.exercises[0];
  if (!exercise || exercise.type !== 'collect-stars') {
    throw new Error('rook-01 is expected to be a collect-stars exercise');
  }

  await completeFirstRun(page, 'Kid');
  const profileId = await getSoleProfileId(page);
  await seedLessonsMastered(page, profileId, [squares, lines, setup]); // unlocks "rook" (World 2)

  await page.reload();
  await pickProfileFromPicker(page, 'Kid');
  await page.getByRole('button', { name: /Start|Continue/ }).click(); // Home -> Story (rook)
  await skipToFirstExercise(page);
  await expect(page.getByText(contentText(exercise.textKey))).toBeVisible();
  await expectMainFits(page, 'collect-stars (before solving)');

  await playSolveLine(page, exercise.position, 'collect-stars');
  await expectFits(page, /^Next/, 'collect-stars (solved)');
});

test('setup exercise: board + piece tray fit, solved Next button fits', async ({ page }) => {
  const squares = findLesson('squares');
  const lines = findLesson('lines');
  const setup = findLesson('setup');
  const exercise = setup.exercises[0];
  if (!exercise || exercise.type !== 'setup') {
    throw new Error('setup-01 is expected to be a setup exercise');
  }

  await completeFirstRun(page, 'Kid');
  const profileId = await getSoleProfileId(page);
  await seedLessonsMastered(page, profileId, [squares, lines]); // unlocks "setup" (World 1, order 3)

  await page.reload();
  await pickProfileFromPicker(page, 'Kid');
  await page.getByRole('button', { name: /Start|Continue/ }).click(); // Home -> Story (setup)
  await skipToFirstExercise(page);
  await expect(page.getByText(contentText(exercise.textKey))).toBeVisible();
  // Piece tray below the board (stacked layout) or beside it (side-by-side): either way, fits.
  await expectMainFits(page, 'setup (before solving, piece tray shown)');

  await solveExercise(page, exercise);
  await expectFits(page, /^Next/, 'setup (solved)');
});

test('Square Hunt boss round: wrong-check note fits, solved round fits', async ({ page }) => {
  const squares = findLesson('squares');
  const lines = findLesson('lines');
  const game = findMiniGame('square-hunt');
  if (game.mode !== 'series') throw new Error('square-hunt is expected to be a series mini-game');
  const round = game.rounds[0];
  if (!round || round.type !== 'select-squares') {
    throw new Error('square-hunt-r1 is expected to be a select-squares round');
  }

  await completeFirstRun(page, 'Kid');
  const profileId = await getSoleProfileId(page);
  await seedLessonMastered(page, profileId, squares); // unlocks "lines" as the current lesson

  await page.reload();
  await pickProfileFromPicker(page, 'Kid');
  await page.getByRole('button', { name: /Start|Continue/ }).click(); // Home -> Story (lines)
  await page.getByRole('button', { name: /Let me try/ }).click(); // Story -> Demo
  await page.getByRole('button', { name: /^Next/ }).click(); // Demo -> first guided try
  // Plays the lesson for real (not seeded) up to its boss: a lesson's own boss only becomes
  // reachable once every exercise is done (`lessonStatus`'s "complete"), which the Journey's own
  // "next lesson" lookup does not track mid-lesson (`domain-model.md` §3.3) — seeding straight to
  // the boss step left "lines" looking finished to the Journey, which then offered "setup" instead.
  for (const guided of lines.guided) {
    await completeExercise(page, guided);
  }
  for (const exercise of lines.exercises) {
    await completeExercise(page, exercise);
  }
  await expect(page.getByText(contentText(round.textKey))).toBeVisible();

  const answer = new Set(selectSquaresAnswer(round));
  const wrongSquare = SQUARES.find((square) => !answer.has(square));
  if (!wrongSquare) throw new Error('square-hunt-r1: every square is a correct answer');

  await clickSquare(page, wrongSquare);
  await page.getByRole('button', { name: /Check/ }).click();
  await expect(page.getByText(contentText('exercise.select-both'))).toBeVisible();
  await expectFits(page, /Check/, 'Square Hunt round 1 (wrong-check note)');

  await clickSquare(page, wrongSquare);
  for (const square of answer) {
    await clickSquare(page, square);
  }
  await page.getByRole('button', { name: /Check/ }).click();
  await expectFits(page, /^Next/, 'Square Hunt round 1 (solved)');
});

test('choice exercise: longest instruction text in the curriculum fits (trades-05)', async ({
  page,
}) => {
  const journeyOrder = lessonsInJourneyOrder(catalog, content.lessons);
  const trades = findLesson('trades');
  const prefix = journeyOrder.slice(
    0,
    journeyOrder.findIndex((lesson) => lesson.id === 'trades'),
  );
  const exercise = trades.exercises[4];
  if (!exercise || exercise.type !== 'choice') {
    throw new Error('trades-05 is expected to be a choice exercise');
  }

  await completeFirstRun(page, 'Kid');
  const profileId = await getSoleProfileId(page);
  await seedLessonsMastered(page, profileId, prefix); // unlocks "trades" (World "attack")

  await page.reload();
  await pickProfileFromPicker(page, 'Kid');
  await page.getByRole('button', { name: /Start|Continue/ }).click(); // Home -> Story (trades)
  await page.getByRole('button', { name: /Let me try/ }).click(); // Story -> Demo
  await page.getByRole('button', { name: /^Next/ }).click(); // Demo -> first guided try
  for (const guided of trades.guided) {
    await completeExercise(page, guided);
  }
  for (const priorExercise of trades.exercises.slice(0, 4)) {
    await completeExercise(page, priorExercise);
  }
  await expect(page.getByText(contentText(exercise.textKey))).toBeVisible();
  // Before answering: 3 option buttons (good/equal/bad) — the tallest panel. At phone width it
  // leaves the board less than its 240px floor (`GameLayout.tsx`), so the page scrolls a little
  // there — accepted: a smaller board would be too small to tap.
  if (test.info().project.name !== 'phone') {
    await expectMainFits(page, 'choice trades-05 (before answering, longest instruction)');
  }

  await solveExercise(page, exercise);
  await expectFits(page, /^Next/, 'choice trades-05 (solved)');
});
