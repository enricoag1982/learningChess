import type { ChessRules, MoveInput } from '../../core/chess/rules.ts';
import type { Color, Position } from '../../core/chess/types.ts';
import type { GameResult, GameState as VariantGameState } from '../../core/game/types.ts';
import {
  gameResult as variantGameResult,
  playGameMove as playVariantMove,
  startGame,
} from '../../core/game/rules.ts';
import type { VersusGameDef, VersusMoveOutcome, VersusState, VersusStatus } from './def.ts';

function current(state: VersusState): VariantGameState {
  const last = state.states[state.states.length - 1];
  if (last === undefined) {
    throw new Error('VersusState.states is empty');
  }
  return last;
}

export function startVersus(def: VersusGameDef): VersusState {
  return { mode: 'versus', def, states: [startGame(def.rules, def.position)], status: 'playing' };
}

export function versusPosition(state: VersusState): Position {
  return current(state).position;
}

export function versusEndReason(state: VersusState): string | undefined {
  return state.endReason;
}

/** The underlying variant-game state, e.g. for a `BotPlayer` adapter's `chooseMove` port. */
export function versusGameState(state: VersusState): VariantGameState {
  return current(state);
}

export function isKidTurn(state: VersusState): boolean {
  return current(state).position.toMove === state.def.kidColor;
}

/** Kid moves played so far (used for the par-based star threshold). */
export function kidMoveCount(state: VersusState): number {
  return current(state).history.filter((move) => move.color === state.def.kidColor).length;
}

function statusFor(result: GameResult, kidColor: Color): VersusStatus {
  if (result.kind === 'ongoing') {
    return 'playing';
  }
  if (result.kind === 'draw') {
    return 'draw';
  }
  return result.winner === kidColor ? 'won' : 'lost';
}

/** Plays one ply — the kid's move or the bot's own — against the shared variant-game rules.
 * `rules` is plain `ChessRules` (no walls/static-opponent: `versus` boards never use them). */
export function playVersusMove(
  state: VersusState,
  rules: ChessRules,
  move: MoveInput,
): { readonly state: VersusState; readonly outcome: VersusMoveOutcome } {
  if (state.status !== 'playing') {
    return { state, outcome: { kind: 'illegal' } };
  }
  const played = playVariantMove(current(state), rules, move);
  if (played === null) {
    return { state, outcome: { kind: 'illegal' } };
  }
  const states = [...state.states, played.state];
  const result = variantGameResult(played.state, rules);
  const status = statusFor(result, state.def.kidColor);
  const endReason = result.kind === 'ongoing' ? undefined : result.reason;
  const nextState: VersusState = {
    ...state,
    states,
    status,
    ...(endReason === undefined ? {} : { endReason }),
  };
  if (status === 'playing') {
    return { state: nextState, outcome: { kind: 'played', move: played.move } };
  }
  return { state: nextState, outcome: { kind: 'ended', move: played.move, status } };
}

/** Undoes the kid's last move and the bot's reply, only when it is the kid's turn with a full round played; the per-level aid
 * gate is the caller's job. */
export function canTakeBack(state: VersusState): boolean {
  return state.status === 'playing' && isKidTurn(state) && state.states.length >= 3;
}

export function takeBackVersusMove(state: VersusState): VersusState {
  if (!canTakeBack(state)) {
    return state;
  }
  return { ...state, states: state.states.slice(0, -2), status: 'playing', endReason: undefined };
}

/** Stars for a finished `versus` boss: 3 = win within par (or win at all, no par), 2 = win, 1 = played to the end. */
export function versusStars(state: VersusState): 0 | 1 | 2 | 3 {
  if (state.status === 'playing') {
    return 0;
  }
  if (state.status !== 'won') {
    return 1;
  }
  const { par } = state.def;
  return par === undefined || kidMoveCount(state) <= par ? 3 : 2;
}
