import type { Page } from '@playwright/test';
import type {
  CompiledContent,
  ExerciseDef,
  Lesson,
  MiniGame,
  Position,
  SelectSquaresDef,
  Square,
  VariantRules,
} from '@chess-kids/core';
import { chessJsRules, createVariantRules, solve } from '@chess-kids/core';
// Node's ESM loader requires this attribute for a JSON import; the content build validates the
// shape (see `bundled-content-source.ts`), so the cast below is a type conversion, not a check.
import rawContent from '@chess-kids/content/content.json' with { type: 'json' };

const content = rawContent as unknown as CompiledContent;
export const rules: VariantRules = createVariantRules(chessJsRules);

export function findLesson(id: string): Lesson {
  const lesson = content.lessons.find((entry) => entry.id === id);
  if (!lesson) throw new Error(`fixture content is missing lesson "${id}"`);
  return lesson;
}

export function findMiniGame(id: string): MiniGame {
  const game = content.minigames.find((entry) => entry.id === id);
  if (!game) throw new Error(`fixture content is missing mini-game "${id}"`);
  return game;
}

/** Answer squares for a select-squares exercise, the same way the engine resolves them. */
export function selectSquaresAnswer(def: SelectSquaresDef): readonly Square[] {
  if ('squares' in def.answer) return def.answer.squares;
  return rules
    .legalMoves(def.position, { staticOpponent: true }, def.answer.from)
    .map((move) => move.to);
}

/** Clicks the board cell named "<square>, ..." (Board.tsx's accessible square names). */
export async function clickSquare(page: Page, square: string): Promise<void> {
  await page.getByRole('button', { name: new RegExp(`^${square},`) }).click();
}

/** Plays a shortest solve line (collect-stars / capture) computed by the core solver. */
export async function playSolveLine(
  page: Page,
  position: Position,
  goal: 'collect-stars' | 'capture',
): Promise<void> {
  const line = solve(position, rules, goal);
  if (!line) throw new Error('no solution found by the core solver');
  for (const move of line) {
    await clickSquare(page, move.from);
    await clickSquare(page, move.to);
  }
}

/** Solves one guided try or scored exercise, then advances past its success panel. */
export async function completeExercise(page: Page, def: ExerciseDef): Promise<void> {
  if (def.type === 'select-squares') {
    for (const square of selectSquaresAnswer(def)) {
      await clickSquare(page, square);
    }
    await page.getByRole('button', { name: /Check/ }).click();
  } else {
    await playSolveLine(page, def.position, def.type);
  }
  await page.getByRole('button', { name: /^Next/ }).click();
}

/** Solves the boss mini-game (a capture game), then advances past its success panel. */
export async function completeBoss(page: Page, game: MiniGame): Promise<void> {
  await playSolveLine(page, game.position, 'capture');
  await page.getByRole('button', { name: /^Next/ }).click();
}

/** From Home, opens today's lesson and advances Story -> Demo -> first guided try. */
export async function startLessonToFirstGuided(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: /Start/ }).click();
  await page.getByRole('button', { name: /Let me try/ }).click(); // Story -> Demo
  await page.getByRole('button', { name: /^Next/ }).click(); // Demo -> first guided try
}
