import type { Hint, Move, MoveOutcome, Square, VariantRules } from '@chess-kids/core/chess';
import type { ExerciseDefBase, ExerciseStateBase } from '@chess-kids/core';
import type { ExerciseState } from '@chess-kids/core/chess';
import type { UiPatch } from './kind-ui.ts';

/** A move's endpoints, for the board's slide / bounce-back highlight. */
export interface FromTo {
  readonly from: Square;
  readonly to: Square;
}

/** UI extras every kind starts from: squares wrongly picked in the last try (orange, never red),
 * and `def.lastMove` (the opponent's last move, e.g. the double step before en passant) seeded at
 * the start — a move kind updates it as the kid plays; yes-no only ever shows the seeded one. */
export interface WrongSquaresExtra {
  readonly wrongSquares: readonly Square[];
  readonly lastMove?: FromTo;
}

/** UI extras every move kind shares (collect-stars, capture, best-move, mate-in-n). */
export interface MoveExtra extends WrongSquaresExtra {
  /** A legal-but-wrong attempt, for the board's slide-and-bounce-back animation. */
  readonly wrongMove?: FromTo;
}

/** `initUi` shared by every kind: seeds `wrongSquares: []` and, when `def.lastMove` is set, the
 * last-move highlight. */
export function baseInitUi(def: { readonly lastMove?: FromTo }): WrongSquaresExtra {
  return { wrongSquares: [], ...(def.lastMove ? { lastMove: def.lastMove } : {}) };
}

/** Shared by every move kind's `toUi` (collect-stars, capture, best-move, mate-in-n's own kinds
 * layer their scripted-reply handling on top of this for the `moved`/`solved` case). Generic in
 * `D`/`S` (never reads either): each kind's own precise pair flows in from its `toUi`'s return type. */
export function moveToUi<
  D extends ExerciseDefBase = ExerciseDefBase,
  S extends ExerciseStateBase<D> = ExerciseStateBase<D>,
>(outcome: MoveOutcome): UiPatch<D, S, MoveExtra> {
  if (outcome.kind === 'illegal') {
    return { feedback: { kind: 'illegal' }, hint: null, wrongSquares: [], wrongMove: undefined };
  }
  if (outcome.kind === 'wrong') {
    return {
      feedback: { kind: 'wrong-move' },
      hint: null,
      wrongSquares: [],
      wrongMove: { from: outcome.move.from, to: outcome.move.to },
    };
  }
  return {
    feedback: outcome.kind === 'solved' ? { kind: 'solved' } : { kind: 'instruction' },
    hint: null,
    wrongSquares: [],
    wrongMove: undefined,
    lastMove: { from: outcome.move.from, to: outcome.move.to },
  };
}

/** The board's `hint` ring squares, for the hint kinds that carry one (`squares` and `yes-no`) —
 * shared by every kind whose hint ladder highlights a square (all but `choice`/`setup`). */
export function hintSquares(hint: Hint | null): readonly Square[] | undefined {
  if (hint === null) return undefined;
  if (hint.kind === 'squares' || hint.kind === 'yes-no') return hint.squares;
  return undefined;
}

/** Legal kid moves right now, for a move kind's board (`[]` once solved) — used only by the 4 move
 * kinds' own `PlayArea`. */
export function moveKindLegalMoves(
  state: ExerciseState,
  rules: VariantRules,
  from?: Square,
): readonly Move[] {
  if (state.solved) return [];
  return rules.legalMoves(state.position, { staticOpponent: true }, from);
}
