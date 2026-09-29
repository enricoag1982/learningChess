import type { Move } from '../chess/rules.ts';
import type { GameState } from '../game/types.ts';

/** The computer opponent for `versus` mini-games; runs in a Web Worker so search never blocks the UI. Chess-bound: wired into web `Services`, not `AppDeps`. */
export interface BotPlayer {
  chooseMove(state: GameState, level: number, seed: number): Promise<Move | null>;
}
