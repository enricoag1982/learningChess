import type { Move } from '../chess/rules.ts';
import type { Color, PieceType, Position, Square } from '../chess/types.ts';

/** How a side can win a variant game; several may apply to one side (any one ends the game). */
export type WinCondition =
  | { readonly kind: 'checkmate' }
  | { readonly kind: 'promote' }
  | { readonly kind: 'capture-all' }
  | { readonly kind: 'capture'; readonly piece: PieceType }
  | { readonly kind: 'reach'; readonly squares: readonly Square[] }
  | { readonly kind: 'survive'; readonly moves: number };

/** Rules for one variant game (standard chess or a mini-game), independent of chess.js. */
export interface GameRulesDef {
  /** Kings on the board; false for kingless mini-games (Pawn Wars, Army Battle, Win the Queen). */
  readonly kings: boolean;
  /** Check / checkmate / stalemate apply; only ever true when both kings are present. */
  readonly checkRules: boolean;
  /** Outcome for the side to move with no legal moves, in kingless (`checkRules: false`) variants. */
  readonly noMoves: 'lose' | 'draw';
  readonly win: { readonly w: readonly WinCondition[]; readonly b: readonly WinCondition[] };
  /** Full-move cap; reached with the game still ongoing draws, unless a `survive` condition wins it. */
  readonly moveLimit?: number;
}

/** Current outcome of a variant game. */
export type GameResult =
  | { readonly kind: 'ongoing' }
  | { readonly kind: 'win'; readonly winner: Color; readonly reason: string }
  | { readonly kind: 'draw'; readonly reason: string };

/**
 * Immutable variant-game progress. `positions` holds every position reached so far (index 0 = the
 * start position), for threefold-repetition detection; `halfmoveClock` is the 50-move counter
 * (resets on a pawn move or a capture).
 */
export interface GameState {
  readonly position: Position;
  readonly history: readonly Move[];
  readonly def: GameRulesDef;
  readonly positions: readonly Position[];
  readonly halfmoveClock: number;
}
