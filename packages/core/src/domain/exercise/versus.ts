import type { ChessRules, Move, MoveInput } from '../chess/rules.ts';
import type { Color, Position } from '../chess/types.ts';
import type { GameRulesDef, GameResult, GameState as VariantGameState } from '../game/types.ts';
import {
  gameResult as variantGameResult,
  playGameMove as playVariantMove,
  startGame,
} from '../game/rules.ts';

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
}

function current(state: VersusState): VariantGameState {
  const last = state.states[state.states.length - 1];
  if (last === undefined) {
    throw new Error('VersusState.states is empty');
  }
  return last;
}

/** Starts a fresh `versus` boss at its authored position. */
export function startVersus(def: VersusGameDef): VersusState {
  return { mode: 'versus', def, states: [startGame(def.rules, def.position)], status: 'playing' };
}

/** The position currently on the board. */
export function versusPosition(state: VersusState): Position {
  return current(state).position;
}

/**
 * The underlying variant-game state (`domain/game`), for the caller that needs more than the bare
 * position — chiefly a `BotPlayer` adapter, whose `chooseMove` port takes this same shape.
 */
export function versusGameState(state: VersusState): VariantGameState {
  return current(state);
}

/** True when it is the kid's turn to move (the opponent otherwise). */
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

/** Result of playing one ply (kid or bot — both go through the same variant-game rules). */
export type VersusMoveOutcome =
  | { readonly kind: 'illegal' }
  | { readonly kind: 'played'; readonly move: Move }
  | { readonly kind: 'ended'; readonly move: Move; readonly status: 'won' | 'lost' | 'draw' };

/**
 * Plays one ply — the kid's move or, once the bot has chosen one (`BotPlayer`), the bot's own —
 * against the shared variant-game rules. `rules` is plain `ChessRules` (no walls/static-opponent:
 * `versus` boards never use them), the same one `chooseMove` used to pick the bot's move.
 */
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
  const nextState: VersusState = { ...state, states, status };
  if (status === 'playing') {
    return { state: nextState, outcome: { kind: 'played', move: played.move } };
  }
  return { state: nextState, outcome: { kind: 'ended', move: played.move, status } };
}

/**
 * Take back: undoes the kid's last move and the bot's reply to it, returning to the kid's turn
 * before that move. Only ever offered while it is the kid's turn again with at least one full
 * round played (`docs/computer-opponent.md` §4: unlimited at Mouse/Rabbit, 3/game at Fox, none at
 * Wolf/Bear — the aid-level gate is the caller's job, this only guards the shape of `states`).
 */
export function canTakeBack(state: VersusState): boolean {
  return state.status === 'playing' && isKidTurn(state) && state.states.length >= 3;
}

/** Undoes the kid's last move and the bot's reply; no-op (returns `state` unchanged) if `!canTakeBack(state)`. */
export function takeBackVersusMove(state: VersusState): VersusState {
  if (!canTakeBack(state)) {
    return state;
  }
  return { ...state, states: state.states.slice(0, -2), status: 'playing' };
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
