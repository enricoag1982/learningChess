import type { ChessRules, Move, MoveInput } from '../chess/rules.ts';
import type { Position } from '../chess/types.ts';
import type { GameResult, GameRulesDef, GameState } from './types.ts';
import { gameResult, playGameMove, startGame } from './rules.ts';

/** Two-human game on one device: the variant rules a `versus` boss plays against the bot, minus bot concerns. `states` holds
 * every position reached (oldest first) so `takeBack` can drop the last. */
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

export function startLocalMatch(rules: GameRulesDef, position: Position): LocalMatchState {
  return { mode: 'local-match', rules, states: [startGame(rules, position)] };
}

export function localMatchPosition(state: LocalMatchState): Position {
  return current(state).position;
}

export function localMatchGameState(state: LocalMatchState): GameState {
  return current(state);
}

export function localMatchResult(state: LocalMatchState, chessRules: ChessRules): GameResult {
  return gameResult(current(state), chessRules);
}

export type LocalMoveOutcome =
  | { readonly kind: 'illegal' }
  | { readonly kind: 'played'; readonly move: Move }
  | { readonly kind: 'ended'; readonly move: Move; readonly result: GameResult };

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

/** Either player may ask at any point mid-match, no bot-style limit; the UI asks the player now to move first. */
export function canTakeBack(state: LocalMatchState, chessRules: ChessRules): boolean {
  return state.states.length >= 2 && localMatchResult(state, chessRules).kind === 'ongoing';
}

export function takeBack(state: LocalMatchState, chessRules: ChessRules): LocalMatchState {
  if (!canTakeBack(state, chessRules)) {
    return state;
  }
  return { ...state, states: state.states.slice(0, -1) };
}
