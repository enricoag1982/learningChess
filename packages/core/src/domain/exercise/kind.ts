/**
 * The exercise-kind abstraction (subject-free; moves to `platform-core` in R4): one exercise type's
 * whole behaviour — state machine, hint ladder, star rule and (content-test-only) its own solved /
 * one-error action sequences — behind a uniform interface so `engine.ts` can dispatch through a
 * registry (`kinds/index.ts`) instead of a type-by-type `if` chain.
 */

/** Fields every exercise kind's state tracks, independent of the exercise's own subject. */
export interface ExerciseProgress {
  readonly solved: boolean;
  readonly errors: number;
  readonly hintLevel: 0 | 1 | 2 | 3;
}

/** A state transition's result: the state after it, plus what happened. */
export interface Step<S, O> {
  readonly state: S;
  readonly outcome: O;
}

/** A text key a def references besides its own `textKey` (e.g. a `choice` option's). */
export interface TextKeyRef {
  readonly key: string;
  /** Issue-message suffix identifying which key this is, e.g. `option "a"`. */
  readonly label: string;
}

/** How a kind's action is driven; replaces the old `NON_MOVE_TYPES` set. */
export type KindInput = 'static-move' | 'real-move' | 'select' | 'answer' | 'place';

/**
 * One exercise type's full behaviour. Method syntax (not arrow-typed fields) is deliberate:
 * TypeScript checks a method's parameter types bivariantly, so a precise
 * `ExerciseKind<SpecificDef, ...>` widens to `AnyExerciseKind` with no `any` and no cast.
 */
export interface ExerciseKind<
  Def extends { readonly type: string; readonly id: string; readonly textKey: string },
  State extends ExerciseProgress & { readonly def: Def },
  Action extends { readonly type: string },
  Outcome,
  Hint,
  Ctx,
> {
  readonly type: Def['type'];
  readonly input: KindInput;
  /** Starts a fresh exercise at its authored position. */
  init(def: Def): State;
  /** Applies one action. */
  act(state: State, action: Action, ctx: Ctx): Step<State, Outcome>;
  /** Advances the hint ladder; `level` is already bumped (capped at 3). */
  hint(state: State, level: 1 | 2 | 3, ctx: Ctx): { readonly state: State; readonly hint: Hint };
  /** Stars earned; only ever called once `state.solved` (the engine keeps the pre-solved `0`). */
  stars(state: State): 1 | 2 | 3;
  /** The action sequence that solves `def` from `init(def)` with 0 errors (content tests, `/testing`). */
  solution(def: Def, ctx: Ctx): readonly Action[];
  /** An action sequence producing exactly 1 error from `init(def)`, otherwise unchanged (content tests). */
  wrongAction?(def: Def, ctx: Ctx): readonly Action[];
  /** Text keys besides `def.textKey` (e.g. `choice` options); default: none. */
  textKeys?(def: Def): readonly TextKeyRef[];
}
