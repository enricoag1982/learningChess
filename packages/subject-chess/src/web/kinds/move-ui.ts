import type { Hint } from '../../core/exercise/hint.ts';
import type { Move } from '../../core/chess/rules.ts';
import type { MoveOutcome } from '../../kinds/static-move.ts';
import type { Square } from '../../core/chess/types.ts';
import type { VariantRules } from '../../core/variant/rules.ts';
import type { ExerciseState, ExerciseStateOf } from '../../core/exercise/state.ts';
import type { ExerciseDefBase, ExerciseStateBase } from '@learn/platform-core';
import type { ExerciseKindUI, PlayAreaProps, UiPatch } from '@learn/platform-web/kinds/kind-ui.ts';
import type { ActionOf, DefOf, ExerciseType, OutcomeOf } from '../../kinds/index.ts';

export type ChessKindUI<T extends ExerciseType, Extra extends object> = ExerciseKindUI<
  DefOf<T>,
  ExerciseStateOf<DefOf<T>>,
  ActionOf<T>,
  OutcomeOf<T>,
  Extra
>;

export type ChessPlayAreaProps<T extends ExerciseType, Extra extends object> = PlayAreaProps<
  DefOf<T>,
  ExerciseStateOf<DefOf<T>>,
  ActionOf<T>,
  Extra
>;

export interface FromTo {
  readonly from: Square;
  readonly to: Square;
}

/** UI extras every kind starts from: squares wrongly picked in the last try (orange, never red) and `def.lastMove` (e.g. the
 * double step before en passant), which a move kind updates as the kid plays. */
export interface WrongSquaresExtra {
  readonly wrongSquares: readonly Square[];
  readonly lastMove?: FromTo;
}

export interface MoveExtra extends WrongSquaresExtra {
  /** A legal-but-wrong attempt, for the board's slide-and-bounce-back animation. */
  readonly wrongMove?: FromTo;
}

/** `initUi` shared by every kind: seeds `wrongSquares: []` and, when `def.lastMove` is set, the last-move highlight. */
export function baseInitUi(def: { readonly lastMove?: FromTo }): WrongSquaresExtra {
  return { wrongSquares: [], ...(def.lastMove ? { lastMove: def.lastMove } : {}) };
}

/** Shared by every move kind's `toUi` (mate-in-n layers its scripted-reply handling on top for `moved` / `solved`); generic in
 * `D` / `S` (never read): each kind's precise pair flows from its `toUi` return type. */
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

/** The board's `hint` ring squares for hint kinds that carry one (`squares`, `yes-no`); all kinds but `choice` / `setup`. */
export function hintSquares(hint: Hint | null): readonly Square[] | undefined {
  if (hint === null) return undefined;
  if (hint.kind === 'squares' || hint.kind === 'yes-no') return hint.squares;
  return undefined;
}

/** Legal kid moves now for a move kind's board (`[]` once solved); used only by the 4 move kinds' `PlayArea`. */
export function moveKindLegalMoves(
  state: ExerciseState,
  rules: VariantRules,
  from?: Square,
): readonly Move[] {
  if (state.solved) return [];
  return rules.legalMoves(state.position, { staticOpponent: true }, from);
}
