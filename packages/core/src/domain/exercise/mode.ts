/**
 * The mini-game-mode abstraction: `static` / `series` / `versus` bosses behind a uniform interface
 * so `boss-result.ts` can dispatch through a registry (`modes/index.ts`) instead of its own
 * type-by-type `if` chain — the mode counterpart of `kind.ts`'s exercise kinds.
 */

/** The attempt-log fields a boss/mini-game result reduces to, whichever mode played it. */
export interface BossResultSummary {
  readonly conceptId: string;
  readonly stars: 0 | 1 | 2 | 3;
  readonly correct: boolean;
  readonly hints: number;
  readonly errors: number;
  readonly moves: number;
}

/**
 * One mini-game mode's whole behaviour. Method syntax (not arrow-typed fields) is deliberate, same
 * reason as `ExerciseKind`: bivariant parameter checking lets a precise `MiniGameMode<D, S>` widen
 * to `AnyMiniGameMode` with no `any` and no cast.
 */
export interface MiniGameMode<Def, State extends { readonly mode: string; readonly def: Def }> {
  readonly mode: State['mode'];
  /** Starts a fresh boss/mini-game at its authored content. */
  start(def: Def): State;
  /** True once the mode's own win condition is met. */
  isWin(state: State): boolean;
  /** Stars earned so far; `0` until won/finished. */
  stars(state: State): 0 | 1 | 2 | 3;
  /** Reduces the state to its attempt-log fields. */
  summarise(state: State): BossResultSummary;
}
