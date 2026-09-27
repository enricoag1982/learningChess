import type {
  ActionOf,
  DefOf,
  ExerciseAction,
  ExerciseDef,
  ExerciseFeedback,
  ExerciseStateOf,
  ExerciseType,
  Hint,
  Move,
  OutcomeOf,
  Position,
  Square,
  VariantRules,
} from '@chess-kids/core';
import type { JSX, ReactNode } from 'react';

/** A move's endpoints, for the board's slide / bounce-back highlight. */
export interface FromTo {
  readonly from: Square;
  readonly to: Square;
}

/** One exercise attempt's UI-only state, layered over the core `ExerciseStateOf<D>`. */
export interface ExerciseUIState<D extends ExerciseDef = ExerciseDef> {
  readonly core: ExerciseStateOf<D>;
  /** Current hint highlight, if any (cleared by a move/toggle/submit/undo). */
  readonly hint: Hint | null;
  readonly feedback: ExerciseFeedback;
  /** Squares wrongly selected/placed in the last try; orange, never red. */
  readonly wrongSquares: readonly Square[];
  /** select-squares, after a wrong check: answer squares the kid had not selected (dashed orange
   * until tapped). Kept across toggles; the play area hides the ones since selected. */
  readonly missedSquares: readonly Square[];
  readonly lastMove?: FromTo;
  /** best-move / mate-in-n: a legal-but-wrong attempt, for the board's slide-and-bounce-back
   * animation. */
  readonly wrongMove?: FromTo;
  /** yes-no: the value last picked wrong, if any — that button turns orange and disables. */
  readonly wrongAnswer?: boolean;
  /** A kind's own move applied but held back from the UI (mate-in-n's scripted reply): `position`
   * is the board right after it; `reveal` is the patch `reveal-reply` applies once its delay ends. */
  readonly pending?: {
    readonly position: Position;
    readonly reveal: Pick<ExerciseUIState, 'lastMove' | 'feedback'>;
  };
}

/** Session-level actions no kind's own `act` sees — the generic reducer handles these directly.
 * Each variant its own literal `type` (not one field with a union of 4 literals) so a chain of
 * `action.type === '…'` checks narrows `SessionAction` down to `ExerciseAction` at the end. */
export type UiAction =
  | { readonly type: 'tap-first' }
  | { readonly type: 'hint' }
  | { readonly type: 'auto-hint' }
  | { readonly type: 'reveal' };

/** Every action `useExerciseSession`'s reducer accepts, across every exercise type. */
export type SessionAction = ExerciseAction | UiAction;

/** What a kind's `toUi` returns: the UI-state fields its own outcome changes (`feedback` always). */
export type UiPatch = Partial<Omit<ExerciseUIState, 'core'>> & Pick<ExerciseUIState, 'feedback'>;

export interface PlayAreaProps<T extends ExerciseType> {
  readonly def: DefOf<T>;
  readonly state: ExerciseUIState<DefOf<T>>;
  readonly dispatch: (action: ActionOf<T> | UiAction) => void;
  /** The checked king's square right now, if any (Board's check ring, all exercise types). */
  readonly checkSquare?: Square;
  /** Hides the Hint button (domain-model.md §3.2: an assessment task offers no hints). */
  readonly showHint: boolean;
  /** Animal-badge piece look (`board/piece-style.ts`). */
  readonly pieceBadges: boolean;
  /** The instruction bubble + replay/skip/easier row — identical across every kind, computed once
   * by the host and rendered above the board/controls (or `done`). */
  readonly top: ReactNode;
  /** The solved-state stars + Next block, or `null` while not solved — also host-computed. */
  readonly done: ReactNode | null;
}

/** One exercise kind's whole UI: how a core outcome becomes a UI patch, and its board + controls.
 * Method syntax is deliberate, same reason as `ExerciseKind`: bivariant parameter checking lets a
 * precise `ExerciseKindUI<T>` widen to the registry's general shape with no cast. */
export interface ExerciseKindUI<T extends ExerciseType> {
  readonly type: T;
  toUi(outcome: OutcomeOf<T>, action: ActionOf<T>, next: ExerciseStateOf<DefOf<T>>): UiPatch;
  PlayArea(props: PlayAreaProps<T>): JSX.Element;
}

/** The board's `hint` ring squares, for the hint kinds that carry one (`squares` and `yes-no`) —
 * shared by every kind whose hint ladder highlights a square (all but `choice`/`setup`). */
export function hintSquares(hint: Hint | null): readonly Square[] | undefined {
  if (hint === null) return undefined;
  if (hint.kind === 'squares' || hint.kind === 'yes-no') return hint.squares;
  return undefined;
}

/** Legal kid moves right now, for a move kind's board (`[]` once solved) — used only by the 4 move
 * kinds' own `PlayArea`, so unlike core's old `exerciseMoves` it never needs the `input` check. */
export function moveKindLegalMoves(
  state: ExerciseStateOf<ExerciseDef>,
  rules: VariantRules,
  from?: Square,
): readonly Move[] {
  if (state.solved) return [];
  return rules.legalMoves(state.position, { staticOpponent: true }, from);
}
