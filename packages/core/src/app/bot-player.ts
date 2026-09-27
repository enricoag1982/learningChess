import type { Move } from '../domain/chess/rules.ts';
import type { GameState } from '../domain/game/types.ts';

/** The computer opponent for `versus` mini-games, runs in a Web Worker so search never blocks the
 * UI thread. Chess-bound: wired into a web adapter's `Services`, not `AppDeps`. */
export interface BotPlayer {
  chooseMove(state: GameState, level: number, seed: number): Promise<Move | null>;
}
