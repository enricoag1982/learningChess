import type { Page } from '@playwright/test';
import type {
  BestMoveDef,
  ChoiceDef,
  CompiledContent,
  ExerciseDef,
  Lesson,
  MiniGame,
  Position,
  SelectSquaresDef,
  SetupDef,
  Square,
  VariantRules,
  YesNoDef,
} from '@chess-kids/core';
import { chessJsRules, createVariantRules, SQUARES, solve } from '@chess-kids/core';
// Node's ESM loader requires this attribute for a JSON import; the content build validates the
// shape (see `bundled-content-source.ts`), so the cast below is a type conversion, not a check.
import rawContent from '@chess-kids/content/content.json' with { type: 'json' };
import rawLocale from '@chess-kids/content/locales/en.json' with { type: 'json' };

const content = rawContent as unknown as CompiledContent;
export const rules: VariantRules = createVariantRules(chessJsRules);

/** A locale namespace as compiled by `packages/content` (nested string tree). */
type LocaleTree = { readonly [key: string]: LocaleTree | string };
const locale = rawLocale as unknown as Record<string, LocaleTree>;

/**
 * Resolves a content text key (e.g. `lessons:rook.title`, `characters:rhino.name`, or a
 * namespace-less `piece.r`, resolved against the `common` default namespace) against the real
 * compiled English strings — the same text the app renders via `tContent`/`t()`. Playwright runs
 * outside React/i18next, so exercise solvers that need to match rendered text (choice options,
 * setup palette buttons) resolve it this way instead of hard-coding English copy.
 */
export function contentText(key: string): string {
  const separatorIndex = key.indexOf(':');
  const namespace = separatorIndex < 0 ? 'common' : key.slice(0, separatorIndex);
  const path = separatorIndex < 0 ? key : key.slice(separatorIndex + 1);
  let node: LocaleTree | string | undefined = locale[namespace];
  for (const segment of path.split('.')) {
    if (typeof node !== 'object') return key;
    node = node[segment];
  }
  return typeof node === 'string' ? node : key;
}

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

/** Answers a yes-no exercise by clicking the correct button (Yes/No, translated). */
async function solveYesNo(page: Page, def: YesNoDef): Promise<void> {
  const label = def.answer ? contentText('exercise.yes') : contentText('exercise.no');
  await page.getByRole('button', { name: label, exact: true }).click();
}

/** Picks the correct option of a choice exercise, by its rendered text or piece aria-label. */
async function solveChoice(page: Page, def: ChoiceDef): Promise<void> {
  const option = def.options.find((entry) => entry.id === def.answer);
  if (!option) throw new Error(`choice exercise "${def.id}" has no option matching its answer`);
  if (option.textKey !== undefined) {
    await page.getByRole('button', { name: contentText(option.textKey), exact: true }).click();
    return;
  }
  if (!option.piece)
    throw new Error(`choice exercise "${def.id}" option has neither text nor piece`);
  const color = contentText(`board.color.${option.piece.color}`);
  const piece = contentText(`board.piece.${option.piece.type}`);
  await page.getByRole('button', { name: `${color} ${piece}`, exact: true }).click();
}

/** Plays the first winning SAN in `solutions`, found via the core rules' legal moves. */
async function solveBestMove(page: Page, def: BestMoveDef): Promise<void> {
  const [san] = def.solutions;
  if (!san) throw new Error(`best-move exercise "${def.id}" has no solutions`);
  const moves = rules.legalMoves(def.position, { staticOpponent: true });
  const move = moves.find((candidate) => candidate.san === san);
  if (!move) throw new Error(`best-move exercise "${def.id}": no legal move matches SAN "${san}"`);
  await clickSquare(page, move.from);
  await clickSquare(page, move.to);
}

/** Places every target piece missing from the starting position, via the setup palette + board. */
async function solveSetup(page: Page, def: SetupDef): Promise<void> {
  const missing = SQUARES.filter(
    (square) =>
      def.target.pieces[square] !== undefined && def.position.pieces[square] === undefined,
  );
  for (const square of missing) {
    const piece = def.target.pieces[square];
    if (!piece) continue;
    const color = contentText(`board.color.${piece.color}`);
    const pieceName = contentText(`board.piece.${piece.type}`);
    await page.getByRole('button', { name: new RegExp(`^${color} ${pieceName},`) }).click();
    await clickSquare(page, square);
  }
}

/** Solves any exercise definition's core interaction, leaving it on its success panel. */
async function solveExercise(page: Page, def: ExerciseDef): Promise<void> {
  switch (def.type) {
    case 'select-squares':
      for (const square of selectSquaresAnswer(def)) {
        await clickSquare(page, square);
      }
      await page.getByRole('button', { name: /Check/ }).click();
      return;
    case 'collect-stars':
    case 'capture':
      await playSolveLine(page, def.position, def.type);
      return;
    case 'yes-no':
      await solveYesNo(page, def);
      return;
    case 'choice':
      await solveChoice(page, def);
      return;
    case 'best-move':
      await solveBestMove(page, def);
      return;
    case 'setup':
      await solveSetup(page, def);
  }
}

/** Solves one guided try or scored exercise, of any type, then advances past its success panel. */
export async function completeExercise(page: Page, def: ExerciseDef): Promise<void> {
  await solveExercise(page, def);
  await page.getByRole('button', { name: /^Next/ }).click();
}

/**
 * Solves a lesson's boss mini-game, then advances past its success panel. Today every boss is a
 * static-capture game, `capture-all` (default) or `collect-stars` (e.g. King Walk, Knight Maze —
 * `game.goal`). A future series boss (several rounds, each an `ExerciseDef`) extends here: solve
 * each round with `completeExercise`'s `solveExercise` step before the final success panel.
 */
export async function completeBoss(page: Page, game: MiniGame): Promise<void> {
  const goal = game.goal === 'collect-stars' ? 'collect-stars' : 'capture';
  await playSolveLine(page, game.position, goal);
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

/**
 * Drives a fresh install through first run (Welcome → parent password → Saved → new player) up
 * to Home. Every Playwright test starts with empty browser storage, so specs that just need Home
 * or a lesson call this first instead of `page.goto('/')` directly (`profiles.spec.ts` is the one
 * spec that exercises first run's own screens in detail).
 */
export async function completeFirstRun(page: Page, nickname = 'Kid'): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start setup' }).click();

  await page.getByLabel('Password', { exact: true }).fill('1234');
  await page.getByLabel('Repeat password').fill('1234');
  await page.getByRole('button', { name: 'Save password' }).click();

  await page.getByRole('button', { name: 'Next' }).click(); // Saved -> new player
  await page.getByPlaceholder('Your name').fill(nickname);
  await page.getByRole('button', { name: 'Next' }).click(); // nickname -> avatar
  await page.getByRole('button', { name: "Let's play!" }).click();

  await page.getByRole('heading', { level: 1, name: 'Chess for Kids' }).waitFor();
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
