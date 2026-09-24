import { expect, test } from '@playwright/test';
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
const rules: VariantRules = createVariantRules(chessJsRules);

function findLesson(id: string): Lesson {
  const lesson = content.lessons.find((entry) => entry.id === id);
  if (!lesson) throw new Error(`fixture content is missing lesson "${id}"`);
  return lesson;
}

function findMiniGame(id: string): MiniGame {
  const game = content.minigames.find((entry) => entry.id === id);
  if (!game) throw new Error(`fixture content is missing mini-game "${id}"`);
  return game;
}

/** Answer squares for a select-squares exercise, the same way the engine resolves them. */
function selectSquaresAnswer(def: SelectSquaresDef): readonly Square[] {
  if ('squares' in def.answer) return def.answer.squares;
  return rules
    .legalMoves(def.position, { staticOpponent: true }, def.answer.from)
    .map((move) => move.to);
}

/** Clicks the board cell named "<square>, ..." (Board.tsx's accessible square names). */
async function clickSquare(page: Page, square: string): Promise<void> {
  await page.getByRole('button', { name: new RegExp(`^${square},`) }).click();
}

/** Plays a shortest solve line (collect-stars / capture) computed by the core solver. */
async function playSolveLine(
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
async function completeExercise(page: Page, def: ExerciseDef): Promise<void> {
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
async function completeBoss(page: Page, game: MiniGame): Promise<void> {
  await playSolveLine(page, game.position, 'capture');
  await page.getByRole('button', { name: /^Next/ }).click();
}

test.describe('Rook lesson', () => {
  test('play the whole lesson end to end, then Continue and reload keep the result', async ({
    page,
  }) => {
    const lesson = findLesson('rook');
    const boss = findMiniGame(lesson.boss ?? '');

    await page.goto('/');
    await page.getByRole('button', { name: /Start/ }).click();
    await page.getByRole('button', { name: /Let me try/ }).click(); // Story -> Demo
    await page.getByRole('button', { name: /^Next/ }).click(); // Demo -> first guided try

    for (const guided of lesson.guided) {
      await completeExercise(page, guided);
    }
    for (const exercise of lesson.exercises) {
      await completeExercise(page, exercise);
    }
    await completeBoss(page, boss);

    await expect(page.getByText('Lesson complete!')).toBeVisible();
    await page.getByRole('button', { name: /Continue/ }).click();

    await expect(page.getByRole('button', { name: /Play again/ })).toBeVisible();
    const starsPill = page.locator('[aria-label$=" stars"]');
    await expect(starsPill).toHaveAttribute('aria-label', /^(?!0 stars$).+/);

    await page.reload();
    await expect(page.getByRole('button', { name: /Play again/ })).toBeVisible();
    await expect(starsPill).toHaveAttribute('aria-label', /^(?!0 stars$).+/);
  });

  test('closing mid-lesson and reopening resumes at the same exercise', async ({ page }) => {
    const lesson = findLesson('rook');

    await page.goto('/');
    await page.getByRole('button', { name: /Start/ }).click();
    await page.getByRole('button', { name: /Let me try/ }).click(); // Story -> Demo
    await page.getByRole('button', { name: /^Next/ }).click(); // Demo -> guided 1

    for (const guided of lesson.guided) {
      await completeExercise(page, guided);
    }
    const [firstExercise, secondExercise] = lesson.exercises;
    if (!firstExercise || !secondExercise || lesson.exercises.length < 3) {
      throw new Error('rook lesson needs at least 3 exercises for this test');
    }
    const stageThreeOfN = `3 of ${String(lesson.exercises.length)}`;

    // Solve exercises 1 and 2, then close right at the start of exercise 3.
    await completeExercise(page, firstExercise);
    await completeExercise(page, secondExercise);
    await expect(page.getByText(stageThreeOfN)).toBeVisible();

    await page.getByRole('button', { name: 'Close lesson' }).click();
    await expect(page.getByRole('button', { name: /Continue/ })).toBeVisible();

    await page.reload();
    await page.getByRole('button', { name: /Continue/ }).click();

    // Resumed at the same exercise (3 of N), not back at the story or an earlier one.
    await expect(page.getByText(stageThreeOfN)).toBeVisible();
  });
});
