import type { Move } from '../../../chess/rules.ts';
import type { Color, Position } from '../../../chess/types.ts';
import type { GameRulesDef, GameState as VariantGameState } from '../../../game/types.ts';

/**
 * Content definition for a `versus` mini-game (Pawn Wars, …): variant rules (kings, custom win
 * conditions) played against the computer opponent, not a static/scripted enemy. `opponentLevel` is
 * the bot level (1 Mouse .. 5 Bear, `domain/bot`); `kidColor` defaults to `w` at the content layer.
 */
export interface VersusGameDef {
  readonly id: string;
  readonly concept: string;
  readonly rules: GameRulesDef;
  readonly position: Position;
  readonly opponentLevel: 1 | 2 | 3 | 4 | 5;
  readonly kidColor: Color;
  /** Kid moves within which a win earns 3 stars (domain-model.md §1.4); undefined = any win is 3. */
  readonly par?: number;
}

export type VersusStatus = 'playing' | 'won' | 'lost' | 'draw';

/**
 * Immutable `versus` boss progress: every position reached so far (`states[0]` = the start), so
 * `takeBackVersusMove` can restore an earlier one without recomputing anything.
 */
export interface VersusState {
  readonly mode: 'versus';
  readonly def: VersusGameDef;
  readonly states: readonly VariantGameState[];
  readonly status: VersusStatus;
  /**
   * The `GameResult.reason` (checkmate, stalemate, threefold-repetition, fifty-move, …) the moment
   * `status` left `'playing'`; unset while still playing. Lets the UI explain *which* draw
   * (computer-opponent.md §6) without recomputing `gameResult` — and, alongside `result`/`opponent`,
   * feeds a `GameRecord`'s own `reason` field once the game is saved.
   */
  readonly endReason?: string;
}

/** Result of playing one ply (kid or bot — both go through the same variant-game rules). */
export type VersusMoveOutcome =
  | { readonly kind: 'illegal' }
  | { readonly kind: 'played'; readonly move: Move }
  | { readonly kind: 'ended'; readonly move: Move; readonly status: 'won' | 'lost' | 'draw' };
