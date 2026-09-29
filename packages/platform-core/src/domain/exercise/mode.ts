// The mini-game-mode abstraction: static/series/versus bosses behind a uniform interface, so
// `boss-result.ts` dispatches through the subject's mode registry — the mode counterpart of `kind.ts`.

export interface BossResultSummary {
  readonly conceptId: string;
  readonly stars: 0 | 1 | 2 | 3;
  readonly correct: boolean;
  readonly hints: number;
  readonly errors: number;
  readonly moves: number;
}

/** One mini-game mode's whole behaviour. Method syntax is deliberate, same reason as `ExerciseKind`:
 * bivariant checking lets a precise `MiniGameMode<D, S>` widen to `AnyMiniGameMode` with no cast. */
export interface MiniGameMode<Def, State extends { readonly mode: string; readonly def: Def }> {
  readonly mode: State['mode'];
  start(def: Def): State;
  /** True once play has ended, win or not (the mode's own "not playing any more"). */
  isOver(state: State): boolean;
  isWin(state: State): boolean;
  /** Stars earned so far; `0` until won/finished. */
  stars(state: State): 0 | 1 | 2 | 3;
  summarise(state: State): BossResultSummary;
}
