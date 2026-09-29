import type { Page } from '@playwright/test';
import type { VersusMiniGame } from '../../core/chess/lesson.ts';
import type { Color, Piece, PieceType, Position, Square } from '../../core/chess/types.ts';
import type { Move } from '../../core/chess/rules.ts';
import { chessJsRules } from '../../core/chess/chessjs-rules.ts';
import { clickSquare } from '../../web/kinds/e2e-actions.ts';
import type { ModeE2E } from '../../web/modes/e2e-registry.ts';

/**
 * Reads the current board straight from the rendered squares' accessible names (`Board.tsx`'s
 * `describeSquare`: `"<square>, <color> <piece>[, <state>]"`) — the fallback a `versus` boss needs:
 * it evolves live against the real bot, so there is no def/expected `data-fen` to compare against
 * before choosing the next kid move (unlike every scripted exercise type).
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
  const COLOR_WORDS: Readonly<Record<string, Color>> = { white: 'w', black: 'b' };
  const PIECE_WORDS: Readonly<Record<string, PieceType>> = {
    pawn: 'p',
    knight: 'n',
    bishop: 'b',
    rook: 'r',
    queen: 'q',
    king: 'k',
  };
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
 * its own; `play` below just loops it to the end). Assumes it is already the kid's turn.
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
 * "Next" tap (`e2e/kit/exercises.ts`'s `completeBoss` does that once, for every mini-game mode).
 */
export async function playVersusBoss(page: Page, game: VersusMiniGame): Promise<void> {
  for (;;) {
    await waitForVersusTurnOrEnd(page);
    const status = await page.locator('[data-versus-status]').getAttribute('data-versus-status');
    if (status !== 'playing') return;

    await playOneKidVersusMove(page, game);
  }
}

/** A `versus` boss's e2e driver: `playVersusBoss` (no `ctx` needed — the kid policy is fixed). */
export const versusE2E: ModeE2E<'versus'> = {
  play: playVersusBoss,
};
