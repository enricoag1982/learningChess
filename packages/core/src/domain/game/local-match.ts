import type { ChessRules, Move, MoveInput } from '../chess/rules.ts';
import type { Position } from '../chess/types.ts';
import type { GameResult, GameRulesDef, GameState } from './types.ts';
import { gameResult, playGameMove, startGame } from './rules.ts';

/**
 * Two-human game (`domain-model.md` §4 "Friend play"): the same variant rules a `versus` boss
 * plays against the bot (`domain/game`), minus every bot concern (level, aids, kid-perspective
 * status) — both sides are a person at this same device. `states` holds every position reached so
 * far, oldest first, so `takeBack` can drop the last one without recomputing anything.
 */
export interface LocalMatchState {
  readonly mode: 'local-match';
  readonly rules: GameRulesDef;
  readonly states: readonly GameState[];
}

function current(state: LocalMatchState): GameState {
  const last = state.states[state.states.length - 1];
  if (last === undefined) {
    throw new Error('LocalMatchState.states is empty');
  }
  return last;
}

/** Starts a fresh local match at `position` under `rules` (full game, Pawn Wars, Win the Queen, …). */
export function startLocalMatch(rules: GameRulesDef, position: Position): LocalMatchState {
  return { mode: 'local-match', rules, states: [startGame(rules, position)] };
}

/** The position currently on the board. */
export function localMatchPosition(state: LocalMatchState): Position {
  return current(state).position;
}

/** The underlying variant-game state, for a caller that needs more than the bare position. */
export function localMatchGameState(state: LocalMatchState): GameState {
  return current(state);
}

/** Current outcome: ongoing, a win (with the winning colour), or a draw — see `domain/game`'s `gameResult`. */
export function localMatchResult(state: LocalMatchState, chessRules: ChessRules): GameResult {
  return gameResult(current(state), chessRules);
}

/** Result of playing one ply — either player's move, both go through the same rules. */
export type LocalMoveOutcome =
  | { readonly kind: 'illegal' }
  | { readonly kind: 'played'; readonly move: Move }
  | { readonly kind: 'ended'; readonly move: Move; readonly result: GameResult };

/** Plays one ply for whichever colour is to move. `illegal` if the move (or the game) has already ended. */
export function playLocalMove(
  state: LocalMatchState,
  chessRules: ChessRules,
  move: MoveInput,
): { readonly state: LocalMatchState; readonly outcome: LocalMoveOutcome } {
  if (localMatchResult(state, chessRules).kind !== 'ongoing') {
    return { state, outcome: { kind: 'illegal' } };
  }
  const played = playGameMove(current(state), chessRules, move);
  if (played === null) {
    return { state, outcome: { kind: 'illegal' } };
  }
  const states = [...state.states, played.state];
  const nextState: LocalMatchState = { ...state, states };
  const result = gameResult(played.state, chessRules);
  if (result.kind === 'ongoing') {
    return { state: nextState, outcome: { kind: 'played', move: played.move } };
  }
  return { state: nextState, outcome: { kind: 'ended', move: played.move, result } };
}

/**
 * Take back: undoes the last move played, returning to the mover's own turn again. Same-device
 * social contract (`docs/app-structure.md` §6): the UI asks the player now to move ("Allow take
 * back?") before calling this — no bot-style limit, either player may ask at any point while the
 * match is ongoing and at least one ply has been played.
 */
export function canTakeBack(state: LocalMatchState, chessRules: ChessRules): boolean {
  return state.states.length >= 2 && localMatchResult(state, chessRules).kind === 'ongoing';
}

/** Undoes the last ply; no-op (returns `state` unchanged) if `!canTakeBack(state, chessRules)`. */
export function takeBack(state: LocalMatchState, chessRules: ChessRules): LocalMatchState {
  if (!canTakeBack(state, chessRules)) {
    return state;
  }
  return { ...state, states: state.states.slice(0, -1) };
}
