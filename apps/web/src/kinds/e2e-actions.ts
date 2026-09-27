// Shared e2e drive primitives for the move kinds (collect-stars, capture, best-move, mate-in-n);
// `Page` is a type-only import — this file is never reachable from app code (see eslint.config.js).
import type { Page } from '@playwright/test';
import type { MoveInput, Position, VariantRules } from '@chess-kids/core/chess';
import { SQUARES, findMoveBySan } from '@chess-kids/core/chess';

/** Clicks the board cell named "<square>, ..." (Board.tsx's accessible square names). */
export async function clickSquare(page: Page, square: string): Promise<void> {
  await page.getByRole('button', { name: new RegExp(`^${square},`) }).click();
}

/**
 * Taps a piece, then a square that is neither a legal destination for it nor another piece's own
 * square (`Board.tsx`'s tap-tap: tapping another piece's square reselects instead of erroring) —
 * always rejected as an illegal move (an error), leaving the position unchanged, then deselects the
 * piece again so a `solution` played right after starts from a clean board.
 */
async function tapIllegalMove(page: Page, position: Position, rules: VariantRules): Promise<void> {
  const moves = rules.legalMoves(position, { staticOpponent: true });
  const [firstMove] = moves;
  if (!firstMove) throw new Error('tapIllegalMove: no legal moves to start from');
  const reachableOrOwn = new Set([
    ...moves.map((move) => move.from),
    ...moves.map((move) => move.to),
  ]);
  const illegalTarget = SQUARES.find((square) => !reachableOrOwn.has(square));
  if (!illegalTarget) throw new Error('tapIllegalMove: no illegal target square available to tap');
  await clickSquare(page, firstMove.from);
  await clickSquare(page, illegalTarget);
  await clickSquare(page, firstMove.from);
}

/**
 * Drives a move kind's `MoveAction` (collect-stars / capture / best-move / mate-in-n all share this
 * shape): a SAN move resolves to its `from`/`to` first (`findMoveBySan`), then both forms play as a
 * from→to tap. The universally-illegal `wrongAction` (`from === to`) has no literal tap equivalent —
 * a second tap on the same square only deselects it (`Board.tsx`) — so it reproduces the same
 * outcome (`onIllegal`, +1 error, position unchanged) via `tapIllegalMove` instead.
 */
export async function performMove(
  page: Page,
  move: MoveInput,
  before: { readonly position: Position },
  rules: VariantRules,
): Promise<void> {
  if (typeof move === 'string') {
    const found = findMoveBySan(rules.legalMoves(before.position, { staticOpponent: true }), move);
    if (!found) throw new Error(`performMove: no legal move matches SAN "${move}"`);
    await clickSquare(page, found.from);
    await clickSquare(page, found.to);
    return;
  }
  if (move.from === move.to) {
    await tapIllegalMove(page, before.position, rules);
    return;
  }
  await clickSquare(page, move.from);
  await clickSquare(page, move.to);
}
