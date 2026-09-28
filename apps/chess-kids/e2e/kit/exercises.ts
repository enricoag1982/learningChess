// The e2e exercise/boss runner: drives any exercise type's solution/wrongAction through its own
// `EXERCISE_KIND_E2E` driver, checking the board's `data-fen` after every step against the same
// core `kind.act` result the driver just reproduced on screen — one mechanism for every type,
// replacing each type's own hand-rolled solver + the versus board's fixed waits/aria-label reads.
import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { Lesson, MiniGame } from '@learn/subject-chess';
import type {
  ExerciseAction,
  ExerciseDef,
  Position,
  SelectSquaresDef,
  Square,
  VariantRules,
} from '@learn/subject-chess';
import {
  chessJsRules,
  createVariantRules,
  kindOf,
  selectSquaresAnswer as coreSelectSquaresAnswer,
  toFen,
} from '@learn/subject-chess';
import { solutionOf } from '@learn/subject-chess/testing';
import { kindE2EOf } from '../../src/kinds/e2e-registry.ts';
import { modeE2EOf } from '../../src/modes/e2e-registry.ts';
import { contentText } from './i18n.ts';

export const rules: VariantRules = createVariantRules(chessJsRules);

/**
 * True for an exercise/guided-try type that moves one piece across the board (has a slide
 * animation). `best-move` is deliberately excluded: unlike collect-stars/capture, a wrong attempt
 * there bounces back without changing the position (nothing to undo), so it shows no Undo button
 * or moves counter — only `firstMoveOf`-style single-move solving.
 */
export function isMoveCountedExercise(def: ExerciseDef): boolean {
  return def.type === 'collect-stars' || def.type === 'capture';
}

/** True for a type whose solved position is reached by playing exactly one piece move (a slide or
 * bounce-back animation): `collect-stars`/`capture` (via a solver line) plus `best-move`. */
export function movesAPiece(def: ExerciseDef): boolean {
  return isMoveCountedExercise(def) || def.type === 'best-move';
}

/** Answer squares for a select-squares exercise (`answer`, or any `derive` kind), via core. */
export function selectSquaresAnswer(def: SelectSquaresDef): readonly Square[] {
  return coreSelectSquaresAnswer(def, rules);
}

/**
 * Folds `actions` over `def`'s own kind, one at a time: computes each step purely via core
 * (`kind.act`, the same call the app's reducer makes), drives the UI to reproduce it
 * (`EXERCISE_KIND_E2E[type].perform`), then — when a board is showing (`choice` may hide it) —
 * waits for the grid's `data-fen` to reach the new core position (absorbs any reveal delay, e.g.
 * mate-in-n's scripted reply, in place of a fixed wait).
 */
async function runActions(
  page: Page,
  def: ExerciseDef,
  actions: readonly ExerciseAction[],
): Promise<void> {
  const kind = kindOf(def);
  const driver = kindE2EOf(def.type);
  let state = kind.init(def);
  for (const action of actions) {
    const before = state;
    const { state: next, outcome } = kind.act(before, action, rules);
    await driver.perform(page, action, { def, before, outcome, rules, text: contentText });
    state = next;
    const grid = page.locator('[role="grid"]').first();
    if ((await grid.count()) > 0) {
      await expect(grid).toHaveAttribute('data-fen', toFen(state.position));
    }
  }
}

/** Solves any exercise definition's core interaction, leaving it on its success panel. */
export async function solveExercise(page: Page, def: ExerciseDef): Promise<void> {
  await runActions(page, def, solutionOf(def).solution(def, rules));
}

/** Solves one guided try or scored exercise, of any type, then advances past its success panel. */
export async function completeExercise(page: Page, def: ExerciseDef): Promise<void> {
  await solveExercise(page, def);
  await page.getByRole('button', { name: /^Next/ }).click();
}

/**
 * Deliberately answers one exercise wrong on the first try (`solutionOf(def).wrongAction`: exactly
 * 1 error, every type), then solves it correctly — domain-model.md §3.2: an assessment task always
 * lets the kid keep trying (only hints are off), but its *first-try* result is what a run scores.
 */
export async function answerExerciseWrongThenSolve(page: Page, def: ExerciseDef): Promise<void> {
  const solution = solutionOf(def);
  const wrong = solution.wrongAction?.(def, rules) ?? [];
  await runActions(page, def, [...wrong, ...solution.solution(def, rules)]);
}

/**
 * Which of `candidates` is on screen right now (single pass, no waiting): matched by its
 * instruction text; when several candidates share that text (e.g. `rook-07` / `queen-07`, "Three
 * pawns, three captures"), by the board's own `data-fen` (piece placement only — the def's own
 * `position`, not necessarily the game's turn/castling state). Call it before the first move.
 */
export async function shownExercise(
  page: Page,
  candidates: readonly ExerciseDef[],
): Promise<ExerciseDef | undefined> {
  let first: ExerciseDef | undefined;
  for (const candidate of candidates) {
    if (await page.getByText(contentText(candidate.textKey), { exact: true }).isVisible()) {
      first = candidate;
      break;
    }
  }
  if (!first) return undefined;
  const text = contentText(first.textKey);
  const sameText = candidates.filter((candidate) => contentText(candidate.textKey) === text);
  if (sameText.length === 1) return first;
  const grid = page.locator('[role="grid"]').first();
  const fen = (await grid.count()) > 0 ? await grid.getAttribute('data-fen') : null;
  if (fen === null) return first;
  const placement = fen.split(' ')[0];
  return (
    sameText.find((candidate) => toFen(candidate.position).split(' ')[0] === placement) ?? first
  );
}

/**
 * Solves whichever of `candidates` is currently on screen, then advances past its success panel;
 * returns the matched definition. For a review task (M3.4 warm-up / Practice), whose exact
 * exercise the app picks at random from a concept's pool — each candidate's own instruction text
 * (never interpolated, so a plain equality match) tells them apart.
 */
export async function solveWhicheverExercise(
  page: Page,
  candidates: readonly ExerciseDef[],
): Promise<ExerciseDef> {
  const shown = await shownExercise(page, candidates);
  if (!shown) {
    throw new Error('solveWhicheverExercise: no candidate instruction text matched what is shown');
  }
  await completeExercise(page, shown);
  return shown;
}

/** Plays a shortest solve line (collect-stars / capture) for a raw `position`/`goal` — a standalone
 * mini-game's own solve, not tied to any authored `ExerciseDef` (`playSolveLine` for World bosses,
 * `Play` tile mini-games). Built as a throwaway def and run the same way any exercise is. */
export async function playSolveLine(
  page: Page,
  position: Position,
  goal: 'collect-stars' | 'capture',
): Promise<void> {
  const def: ExerciseDef = {
    id: '_solve-line',
    concept: '_solve-line',
    textKey: '_solve-line',
    position,
    stars2: 1,
    stars3: 1,
    type: goal,
  };
  await solveExercise(page, def);
}

/**
 * Solves a lesson's boss mini-game, then advances past its result panel — `game.mode`'s own e2e
 * driver (`MINI_GAME_MODE_E2E`): `static` solves the goal it reduces to, `series` plays every round
 * like an exercise, `versus` plays out against the real bot.
 */
export async function completeBoss(page: Page, game: MiniGame): Promise<void> {
  await modeE2EOf(game.mode).play(page, game, { text: contentText, solve: solveExercise });
  await page.getByRole('button', { name: /^Next/ }).click();
}

/**
 * Plays a whole lesson end to end from its first guided try (see `startLessonToFirstGuided`):
 * every guided try, every scored exercise (any type), then the boss if the lesson has one.
 * Leaves the page on the lesson's Complete step.
 */
export async function playLesson(
  page: Page,
  lesson: Lesson,
  minigames: readonly MiniGame[],
): Promise<void> {
  for (const guided of lesson.guided) {
    await completeExercise(page, guided);
  }
  for (const exercise of lesson.exercises) {
    await completeExercise(page, exercise);
  }
  if (lesson.boss) {
    const boss = minigames.find((game) => game.id === lesson.boss);
    if (!boss) throw new Error(`playLesson: mini-game "${lesson.boss}" not found`);
    await completeBoss(page, boss);
  }
}
