import type { Page } from '@playwright/test';
import type {
  BestMoveDef,
  ChoiceDef,
  Color,
  ExerciseDef,
  Lesson,
  MateInNDef,
  MiniGame,
  Move,
  Piece,
  PieceType,
  Position,
  SelectSquaresDef,
  SetupDef,
  Square,
  VariantRules,
  VersusMiniGame,
  YesNoDef,
} from '@chess-kids/core';
import {
  chessJsRules,
  createVariantRules,
  selectSquaresAnswer as coreSelectSquaresAnswer,
  SQUARES,
  solve,
} from '@chess-kids/core';
// `helpers.ts` re-exports these three kits so every existing `from './helpers.ts'` import keeps
// working unchanged: `kit/i18n.ts` (contentText, interpolate, over a standalone i18next instance),
// `kit/content.ts` (typed bundled content/catalog, content-derived Journey text, and the
// content/tracks lookups every spec used to copy locally: findWorld, firstJourneyLesson,
// firstTwoLessons) and `kit/storage.ts` (withAppStorage + the 13 seed/read helpers, over the real
// repositories instead of hand-written localStorage JSON). `contentText` is also used bare below
// (exercise/setup solving still lives here — R3b moves it).
import { contentText } from './kit/i18n.ts';
export * from './kit/i18n.ts';
export * from './kit/content.ts';
export * from './kit/storage.ts';

export const rules: VariantRules = createVariantRules(chessJsRules);

/**
 * True for an exercise/guided-try type that moves one piece across the board (has a slide
 * animation). `best-move` is deliberately excluded: unlike collect-stars/capture, a wrong attempt
 * there bounces back without changing the position (nothing to undo), so `exercise-play-area.tsx`
 * shows no Undo button or moves counter for it — only `firstMoveOf`-style single-move solving.
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
  // Normalized (check/mate marks stripped), same as the engine's own SAN comparison
  // (`engine.ts`'s `isSolutionMove`): a `verify: check`/`escape-*` solution (M3.3) is always a
  // checking move, so chess.js's own SAN for it always carries a "+"/"#" the authored SAN may not.
  const move = moves.find((candidate) => normalizeSan(candidate.san) === normalizeSan(san));
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

/** Strips a trailing check/mate mark, matching the engine's own SAN comparison (`engine.ts`). */
function normalizeSan(san: string): string {
  return san.replace(/[+#]+$/, '');
}

/**
 * Plays every scripted kid move of a mate-in-n exercise (`playMateInN`'s "moved" outcome mirrored
 * here without the app's state): after each ply with a scripted reply, waits out the reply's
 * ~600ms reveal delay (`ExerciseStep.tsx`) before the board accepts the next kid move.
 */
async function solveMateInN(page: Page, def: MateInNDef): Promise<void> {
  let position = def.position;
  for (let i = 0; i < def.line.length; i += 2) {
    const san = def.line[i];
    if (san === undefined) {
      throw new Error(`mate-in-n exercise "${def.id}": line is missing move ${String(i)}`);
    }
    const candidates = chessJsRules.legalMoves(position);
    const move = candidates.find((candidate) => normalizeSan(candidate.san) === normalizeSan(san));
    if (!move) {
      throw new Error(`mate-in-n exercise "${def.id}": no legal move matches SAN "${san}"`);
    }
    await clickSquare(page, move.from);
    await clickSquare(page, move.to);

    const played = chessJsRules.play(position, san);
    if (!played) {
      throw new Error(`mate-in-n exercise "${def.id}": "${san}" is illegal from this position`);
    }
    position = played.position;

    const replySan = def.line[i + 1];
    if (replySan !== undefined) {
      const repliedPlay = chessJsRules.play(position, replySan);
      if (!repliedPlay) {
        throw new Error(`mate-in-n exercise "${def.id}": scripted reply "${replySan}" is illegal`);
      }
      position = repliedPlay.position;
      await page.waitForTimeout(700);
    }
  }
}

/** Solves any exercise definition's core interaction, leaving it on its success panel. */
export async function solveExercise(page: Page, def: ExerciseDef): Promise<void> {
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
    case 'mate-in-n':
      await solveMateInN(page, def);
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
 * Deliberately answers one exercise wrong on the first try, then solves it correctly (M4.5: an
 * assessment task always lets the kid keep trying — only hints are off — but its *first-try*
 * result is what the run scores). Covers the exercise types World 1 ("board") and World 2
 * ("pieces") actually use: `yes-no`, `choice`, `select-squares`, and the movement types
 * (`collect-stars`/`capture` via one illegal-square tap; `best-move` via a legal-but-wrong move,
 * when one exists, since `engine.ts`'s `playMove` already flags any non-solution move as an error
 * without needing an illegal one).
 */
export async function answerExerciseWrongThenSolve(page: Page, def: ExerciseDef): Promise<void> {
  switch (def.type) {
    case 'yes-no': {
      const wrongLabel = def.answer ? contentText('exercise.no') : contentText('exercise.yes');
      await page.getByRole('button', { name: wrongLabel, exact: true }).click();
      await solveExercise(page, def);
      return;
    }
    case 'choice': {
      const wrong = def.options.find((option) => option.id !== def.answer);
      if (!wrong) throw new Error(`choice exercise "${def.id}" has no wrong option to pick`);
      if (wrong.textKey !== undefined) {
        await page.getByRole('button', { name: contentText(wrong.textKey), exact: true }).click();
      } else if (wrong.piece) {
        const color = contentText(`board.color.${wrong.piece.color}`);
        const piece = contentText(`board.piece.${wrong.piece.type}`);
        await page.getByRole('button', { name: `${color} ${piece}`, exact: true }).click();
      }
      await solveExercise(page, def);
      return;
    }
    case 'select-squares': {
      const answer = new Set(selectSquaresAnswer(def));
      const wrongSquare = SQUARES.find((square) => !answer.has(square));
      if (!wrongSquare)
        throw new Error(`select-squares exercise "${def.id}": every square is correct`);
      await clickSquare(page, wrongSquare); // select a wrong one
      await page.getByRole('button', { name: /Check/ }).click(); // wrong check, first try spent
      await clickSquare(page, wrongSquare); // deselect it again before solving for real
      await solveExercise(page, def);
      return;
    }
    case 'best-move': {
      const moves = rules.legalMoves(def.position, { staticOpponent: true });
      const solutionSans = new Set(def.solutions.map(normalizeSan));
      const wrongMove = moves.find((move) => !solutionSans.has(normalizeSan(move.san)));
      if (wrongMove) {
        await clickSquare(page, wrongMove.from);
        await clickSquare(page, wrongMove.to); // legal, but not the solution: an error either way
        await solveExercise(page, def);
        return;
      }
      // Every legal move happens to be a solution (rare): fall through to the illegal-tap path.
      await tapIllegalMove(page, def.position);
      await solveExercise(page, def);
      return;
    }
    case 'collect-stars':
    case 'capture': {
      await tapIllegalMove(page, def.position);
      await solveExercise(page, def);
      return;
    }
    default:
      throw new Error(`answerExerciseWrongThenSolve: exercise type "${def.type}" not supported`);
  }
}

/**
 * Taps a piece, then a square that is neither a legal destination for it nor another piece's own
 * square (`Board.tsx`'s tap-tap: tapping another piece's square reselects instead of erroring) —
 * always rejected as an illegal move (an error), leaving the position unchanged, then deselects the
 * piece again so the `solveExercise` call that follows starts from a clean board.
 */
async function tapIllegalMove(page: Page, position: Position): Promise<void> {
  const moves = rules.legalMoves(position, { staticOpponent: true });
  const [firstMove] = moves;
  if (!firstMove) throw new Error('tapIllegalMove: no legal moves to start from');
  const reachableOrOwn = new Set([
    ...moves.map((move) => move.from),
    ...moves.map((move) => move.to),
  ]);
  const illegalTarget = SQUARES.find((square) => !reachableOrOwn.has(square));
  if (!illegalTarget) throw new Error('tapIllegalMove: no illegal target square available to tap');
  await clickSquare(page, firstMove.from); // select the piece
  await clickSquare(page, illegalTarget); // rejected: an error, position unchanged
  // Board.tsx never clears `selected` after a rejected attempt (on purpose, so the kid can retry at
  // once) — deselect it again here, the same way the select-squares case above does, so the
  // solveExercise call that follows this one starts from a clean, nothing-selected board (its own
  // first click assumes that, same as a fresh exercise).
  await clickSquare(page, firstMove.from);
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

/**
 * Which of `candidates` is on screen right now (single pass, no waiting): matched by its
 * instruction text; when several candidates share that text (e.g. `rook-07` / `queen-07`, "Three
 * pawns, three captures"), by its starting pieces on the rendered board too. Call it before the
 * first move of the task.
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
  const board = await readVersusPieces(page);
  return sameText.find((candidate) => samePieces(candidate.position.pieces, board)) ?? first;
}

function samePieces(
  a: Readonly<Partial<Record<Square, Piece>>>,
  b: Readonly<Partial<Record<Square, Piece>>>,
): boolean {
  const squares = Object.keys(a) as Square[];
  if (squares.length !== Object.keys(b).length) return false;
  return squares.every((square) => {
    const pa = a[square];
    const pb = b[square];
    return pa !== undefined && pb !== undefined && pa.color === pb.color && pa.type === pb.type;
  });
}

/** Reverse-lookup maps (rendered English word → chess letter) for `readVersusPieces`. */
const COLOR_WORDS: Readonly<Record<string, Color>> = {
  [contentText('board.color.w')]: 'w',
  [contentText('board.color.b')]: 'b',
};
const PIECE_WORDS: Readonly<Record<string, PieceType>> = {
  [contentText('board.piece.p')]: 'p',
  [contentText('board.piece.n')]: 'n',
  [contentText('board.piece.b')]: 'b',
  [contentText('board.piece.r')]: 'r',
  [contentText('board.piece.q')]: 'q',
  [contentText('board.piece.k')]: 'k',
};

/**
 * Reads the current board straight from the rendered squares' accessible names (Board.tsx's
 * `describeSquare`: `"<square>, <color> <piece>[, <state>]"`), the only way a Playwright spec can
 * see a `versus` boss's position — it evolves live against the real bot, so there is no content
 * definition to read it from partway through, unlike every other exercise type.
 */
async function readVersusPieces(page: Page): Promise<Partial<Record<Square, Piece>>> {
  // One round trip for every square's aria-label (`page.evaluate`), not 64 (one `getAttribute`
  // each) — the difference between a `versus` boss finishing in seconds or in minutes, since this
  // runs once per kid move for as long as the game against the bot lasts.
  const labels = await page.evaluate(() =>
    [...document.querySelectorAll('[role="gridcell"] button')].map((element) =>
      element.getAttribute('aria-label'),
    ),
  );
  const pieces: Partial<Record<Square, Piece>> = {};
  for (const label of labels) {
    // `\w+` (not `\S+`): a danger/selected/etc. suffix follows as ", in danger" — a comma right
    // after the piece word, which `\S+` would swallow (e.g. "pawn," failing every colour/piece
    // lookup below and silently dropping that square, exactly the pieces a versus boss most
    // needs — its own attacked, undefended ones).
    const match = label === null ? null : /^([a-h][1-8]), (\w+) (\w+)/.exec(label);
    if (match === null) continue;
    const [, square, colorWord, pieceWord] = match;
    const color = colorWord === undefined ? undefined : COLOR_WORDS[colorWord];
    const type = pieceWord === undefined ? undefined : PIECE_WORDS[pieceWord];
    if (square !== undefined && color !== undefined && type !== undefined) {
      pieces[square as Square] = { color, type };
    }
  }
  return pieces;
}

/** Ranks advanced toward promotion (0 = still on the back rank). */
function pawnAdvance(move: Move, color: Color): number {
  const rank = Number(move.to[1]);
  return color === 'w' ? rank - 1 : 8 - rank;
}

/** True when no enemy pawn attacks `move.to` once `move` is played. */
function isSafeAfter(position: Position, move: Move, kidColor: Color): boolean {
  const played = chessJsRules.play(position, move);
  if (played === null) return false;
  const opponent: Color = kidColor === 'w' ? 'b' : 'w';
  return chessJsRules.attackers(played.position, move.to, opponent).length === 0;
}

/**
 * The e2e kid policy for a `versus` boss (Pawn Wars): capture if possible, else push the most
 * advanced pawn that stays safe (no enemy pawn would then attack it), else any legal move.
 */
function chooseKidVersusMove(
  pieces: Partial<Record<Square, Piece>>,
  kidColor: Color,
): { readonly from: Square; readonly to: Square } {
  const position: Position = {
    pieces,
    markers: { stars: [], blocked: [] },
    toMove: kidColor,
    castling: '-',
    enPassant: null,
  };
  const legalMoves = chessJsRules.legalMoves(position);
  const capture = legalMoves.find((move) => move.captured !== undefined);
  if (capture !== undefined) return capture;

  const byAdvance = [...legalMoves].sort(
    (a, b) => pawnAdvance(b, kidColor) - pawnAdvance(a, kidColor),
  );
  const safe = byAdvance.find((move) => isSafeAfter(position, move, kidColor));
  const chosen = safe ?? byAdvance[0];
  if (chosen === undefined) {
    throw new Error('chooseKidVersusMove: no legal move for the kid');
  }
  return chosen;
}

/** Blocks until the versus panel shows the kid's turn, or the game has ended either way. */
export async function waitForVersusTurnOrEnd(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const panel = document.querySelector('[data-versus-status]');
      if (panel === null) return true;
      const status = panel.getAttribute('data-versus-status');
      const turn = panel.getAttribute('data-versus-turn');
      return status !== 'playing' || turn === 'kid';
    },
    undefined,
    { timeout: 15000 },
  );
}

/**
 * Plays exactly one kid move in a `versus` boss (the a11y walk's mid-game deep scan needs this on
 * its own; `playVersusBoss` below just loops it to the end). Assumes it is already the kid's turn.
 */
export async function playOneKidVersusMove(page: Page, game: VersusMiniGame): Promise<void> {
  const pieces = await readVersusPieces(page);
  const move = chooseKidVersusMove(pieces, game.kidColor);
  await clickSquare(page, move.from);
  await clickSquare(page, move.to);
}

/**
 * Plays a `versus` boss (Pawn Wars) to its end against the real (seeded or not) bot, using
 * `chooseKidVersusMove` for every kid move. Leaves the page on the result panel, before its
 * "Next" tap (`completeBoss` does that once, for every mini-game mode).
 */
export async function playVersusBoss(page: Page, game: VersusMiniGame): Promise<void> {
  for (;;) {
    await waitForVersusTurnOrEnd(page);
    const status = await page.locator('[data-versus-status]').getAttribute('data-versus-status');
    if (status !== 'playing') return;

    await playOneKidVersusMove(page, game);
  }
}

/**
 * Solves a lesson's boss mini-game, then advances past its result panel. `static` games are
 * solved with the solver line for their goal (`capture-all` or `collect-stars`); `series` games
 * play each round like an exercise, tapping Next between rounds; `versus` games are played out
 * against the real bot via `playVersusBoss`.
 */
export async function completeBoss(page: Page, game: MiniGame): Promise<void> {
  if (game.mode === 'series') {
    for (const round of game.rounds) {
      await solveExercise(page, round);
      await page.getByRole('button', { name: /^Next/ }).click();
    }
  } else if (game.mode === 'versus') {
    await playVersusBoss(page, game);
  } else {
    const goal = game.goal === 'collect-stars' ? 'collect-stars' : 'capture';
    await playSolveLine(page, game.position, goal);
  }
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
/**
 * Welcome → password → saved → new player (nickname, avatar), stopping right at the M4.5
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

/** `completeFirstRunToPlacementOffer`, then declines placement ("No, start at World 1") — every
 * spec that only needs a fresh profile on Home keeps this same contract after M4.5. */
export async function completeFirstRun(page: Page, nickname = 'Kid'): Promise<void> {
  await completeFirstRunToPlacementOffer(page, nickname);
  await page.getByRole('button', { name: contentText('placement.offer-no') }).click();
  await page.getByRole('heading', { level: 1, name: 'Chess for Kids' }).waitFor();
}

/**
 * Dismisses the M4.4 badge celebration overlay if one is showing (a no-op otherwise) — lesson
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
