// Shared e2e drive primitives for the move kinds (collect-stars, capture, best-move, mate-in-n);
// `Page` is a type-only import — this file is never reachable from app code (see eslint.config.js).
import type { Page } from '@playwright/test';
import type { MoveInput } from '../../core/chess/rules.ts';
import type { Position } from '../../core/chess/types.ts';
import type { VariantRules } from '../../core/variant/rules.ts';
import { SQUARES } from '../../core/chess/types.ts';
import { findMoveBySan } from '../../core/chess/facts/san.ts';

export async function clickSquare(page: Page, square: string): Promise<void> {
  await page.getByRole('button', { name: new RegExp(`^${square},`) }).click();
}

/** Taps a piece, then a square that is neither a legal destination nor another piece's square (`Board.tsx`: that reselects) so
 * it is rejected as illegal (+1 error, position unchanged), then deselects so a following `solution` starts clean. */
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

/** Drives a move kind's `MoveAction`: a SAN move resolves to from/to (`findMoveBySan`), then plays as a from→to tap. The illegal
 * `wrongAction` (`from === to`) has no literal tap (a second tap only deselects), so `tapIllegalMove` reproduces its outcome. */
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
