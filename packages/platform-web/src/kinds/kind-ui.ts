import type {
  ExerciseDefBase,
  ExerciseFeedbackBase,
  ExerciseStateBase,
  HintBase,
} from '@learn/platform-core';
import type { JSX, ReactNode } from 'react';
import type { SurfaceContext } from '../app/subject.ts';

/** UI-only state over the core state: `core`, `hint`, `feedback`, `pending?` are shared by every kind; a kind's extras
 * (`Extra`, e.g. `lastMove`) come from `initUi` / `toUi`. */
export type ExerciseUIState<
  D extends ExerciseDefBase = ExerciseDefBase,
  S extends ExerciseStateBase<D> = ExerciseStateBase<D>,
  Extra extends object = object,
> = {
  readonly core: S;
  /** Current hint highlight, if any (cleared by a move/toggle/submit/undo). */
  readonly hint: HintBase | null;
  readonly feedback: ExerciseFeedbackBase;
  /** A kind's own move applied but held back from the UI (mate-in-n's scripted reply): `state` is
   * right after it; `reveal` is the patch `reveal-reply` applies once its delay ends. */
  readonly pending?: {
    readonly state: S;
    readonly reveal: Partial<Extra & { readonly feedback: ExerciseFeedbackBase }>;
  };
} & Extra;

/** Session-level actions no kind's `act` sees; each variant has its own literal `type` (not a union field) so
 * `action.type === '…'` chains narrow to the kind's action type. */
export type UiAction =
  | { readonly type: 'tap-first' }
  | { readonly type: 'hint' }
  | { readonly type: 'auto-hint' }
  | { readonly type: 'reveal' };

export type SessionAction<A extends { readonly type: string } = { readonly type: string }> =
  A | UiAction;

/** What a kind's `toUi` returns: the UI-state fields its own outcome changes (`feedback` always). */
export type UiPatch<
  D extends ExerciseDefBase = ExerciseDefBase,
  S extends ExerciseStateBase<D> = ExerciseStateBase<D>,
  Extra extends object = object,
> = Partial<Extra> & {
  readonly feedback: ExerciseFeedbackBase;
  readonly hint?: HintBase | null;
  readonly pending?: ExerciseUIState<D, S, Extra>['pending'];
};

export interface PlayAreaProps<
  D extends ExerciseDefBase = ExerciseDefBase,
  S extends ExerciseStateBase<D> = ExerciseStateBase<D>,
  A extends { readonly type: string } = { readonly type: string },
  Extra extends object = object,
> {
  readonly def: D;
  readonly state: ExerciseUIState<D, S, Extra>;
  readonly dispatch: (action: SessionAction<A>) => void;
  /** Hides the Hint button (domain-model.md §3.2: an assessment task offers no hints). */
  readonly showHint: boolean;
  /** The board's check ring (default on; a `series` round keeps it off, `docs/refactor-v4.md`
   * follow-up F6). */
  readonly showCheck: boolean;
  readonly surface: SurfaceContext;
  /** The instruction bubble + replay/skip/easier row — identical across every kind, computed once
   * by the host and rendered above the board/controls (or `done`). */
  readonly top: ReactNode;
  /** The solved-state stars + Next block, or `null` while not solved — also host-computed. */
  readonly done: ReactNode | null;
}

/** One exercise kind's whole UI: core outcome → UI patch, its extra UI fields' initial values, board + controls. Method syntax:
 * bivariance lets a precise `ExerciseKindUI` widen with no cast. */
export interface ExerciseKindUI<
  D extends ExerciseDefBase = ExerciseDefBase,
  S extends ExerciseStateBase<D> = ExerciseStateBase<D>,
  A extends { readonly type: string } = { readonly type: string },
  O = unknown,
  Extra extends object = object,
> {
  readonly type: string;
  /** `def`'s extra UI fields at the start of an attempt (e.g. a move kind's `lastMove`, seeded from `def.lastMove`). */
  initUi(def: D): Extra;
  /** Extras to merge in on a hint request: clears a kind's own "wrong" markers without touching a
   * persistent extra like `lastMove`. */
  clearWrongUi(): Partial<Extra>;
  toUi(outcome: O, action: A, next: S): UiPatch<D, S, Extra>;
  PlayArea(props: PlayAreaProps<D, S, A, Extra>): JSX.Element;
}

export type AnyExerciseKindUI = ExerciseKindUI;
