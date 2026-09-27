import type { Move } from '../domain/chess/rules.ts';
import type { GameState } from '../domain/game/types.ts';

/** The computer opponent for `versus` mini-games. Runs in a Web Worker so search never blocks the
 * UI thread; same position + level + seed always replies with the same move (deterministic
 * `Random`). Chess-bound (design-r4.md §2 leak #7): a web adapter's `Services`, not `AppDeps` —
 * the platform use cases never call it directly. */
export interface BotPlayer {
  chooseMove(state: GameState, level: number, seed: number): Promise<Move | null>;
}
