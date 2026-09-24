import type { Move, game } from '@chess-kids/core';

/** Main thread → worker: choose a move for `state` at `level` (`BotLevel.level`), seeded. */
export interface BotRequest {
  readonly id: number;
  readonly state: game.GameState;
  readonly level: number;
  readonly seed: number;
}

/** Worker → main thread: the chosen move (`null` = no legal move), or the search's own error. */
export type BotResponse =
  | { readonly id: number; readonly move: Move | null }
  | { readonly id: number; readonly error: string };
