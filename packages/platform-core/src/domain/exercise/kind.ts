// The exercise-kind abstraction (subject-free): one exercise type's whole behaviour behind a
// uniform interface, so `engine.ts` dispatches through a registry (`kinds/index.ts`), not an `if` chain.

export interface ExerciseProgress {
  readonly solved: boolean;
  readonly errors: number;
  readonly hintLevel: 0 | 1 | 2 | 3;
}

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

export type KindInput = 'static-move' | 'real-move' | 'select' | 'answer' | 'place';

/** One exercise type's full behaviour. Method syntax is deliberate: bivariant parameter checking
 * lets a precise `ExerciseKind<SpecificDef, ...>` widen to `AnyExerciseKind` with no cast. */
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
  init(def: Def): State;
  act(state: State, action: Action, ctx: Ctx): Step<State, Outcome>;
  /** Advances the hint ladder; `level` is already bumped (capped at 3). */
  hint(state: State, level: 1 | 2 | 3, ctx: Ctx): { readonly state: State; readonly hint: Hint };
  /** Stars earned; only ever called once `state.solved` (the engine keeps the pre-solved `0`). */
  stars(state: State): 1 | 2 | 3;
}

/** A kind's content-test-only action sequences — kept out of `ExerciseKind`/`EXERCISE_KINDS` so
 * this code, and whatever `solution` pulls in, is reachable only from `/testing` and content. */
export interface ExerciseSolution<
  Def extends { readonly type: string; readonly id: string; readonly textKey: string },
  Action extends { readonly type: string },
  Ctx,
> {
  /** The action sequence that solves `def` from `init(def)` with 0 errors (content tests, `/testing`). */
  solution(def: Def, ctx: Ctx): readonly Action[];
  /** An action sequence producing exactly 1 error from `init(def)`, otherwise unchanged (content tests). */
  wrongAction?(def: Def, ctx: Ctx): readonly Action[];
}
