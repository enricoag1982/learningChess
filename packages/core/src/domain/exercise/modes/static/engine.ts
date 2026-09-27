import type { MoveInput } from '../../../chess/rules.ts';
import type { VariantRules } from '../../../variant/rules.ts';
import { playMove } from '../../kinds/static-move.ts';
import { initState } from '../../state.ts';
import type { CaptureDef, CollectStarsDef } from '../../types.ts';
import { staticGoalExercise } from './def.ts';
import type { GameOutcome, GameState, StaticCaptureGameDef } from './def.ts';

function toGoalDef(def: StaticCaptureGameDef): CaptureDef | CollectStarsDef {
  return staticGoalExercise({
    id: def.id,
    concept: def.concept,
    textKey: def.id,
    position: def.position,
    goal: def.goal,
    par: def.par,
  });
}

/** Starts a fresh mini-game at its authored position. */
export function startStaticCaptureGame(def: StaticCaptureGameDef): GameState {
  return { mode: 'static', def, exercise: initState(toGoalDef(def)), ended: false };
}

/** Plays one kid move. Reuses the capture exercise engine for legality and win detection. */
export function playGameMove(
  state: GameState,
  rules: VariantRules,
  move: MoveInput,
): { readonly state: GameState; readonly outcome: GameOutcome } {
  if (state.ended || state.exercise.solved) {
    return { state, outcome: { kind: 'illegal' } };
  }

  const { state: exercise, outcome } = playMove(state.exercise, rules, move);
  if (outcome.kind === 'illegal') {
    return { state: { ...state, exercise }, outcome: { kind: 'illegal' } };
  }
  if (outcome.kind === 'wrong') {
    // Mini-games are always `capture` or `collect-stars` exercises (see `toGoalDef`): `playMove`
    // never produces this outcome for them (best-move only). Handled for exhaustiveness, not
    // reachability.
    return { state: { ...state, exercise }, outcome: { kind: 'illegal' } };
  }

  const captured = outcome.captured === undefined ? {} : { captured: outcome.captured };
  if (outcome.kind === 'solved') {
    return {
      state: { ...state, exercise },
      outcome: { kind: 'won', move: outcome.move, ...captured },
    };
  }

  const limitReached = state.def.moveLimit !== undefined && exercise.moves >= state.def.moveLimit;
  if (limitReached) {
    return {
      state: { ...state, exercise, ended: true },
      outcome: { kind: 'ended', move: outcome.move, ...captured },
    };
  }
  return {
    state: { ...state, exercise },
    outcome: { kind: 'playing', move: outcome.move, ...captured },
  };
}

/** Current mini-game status. */
export function gameResult(state: GameState): 'playing' | 'won' | 'ended' {
  if (state.exercise.solved) {
    return 'won';
  }
  return state.ended ? 'ended' : 'playing';
}

/** Stars for the mini-game: 3 = win within par, 2 = win, 1 = played to the move limit. */
export function gameStars(state: GameState): 0 | 1 | 2 | 3 {
  const result = gameResult(state);
  if (result === 'playing') {
    return 0;
  }
  if (result === 'ended') {
    return 1;
  }
  return state.exercise.moves <= state.def.par ? 3 : 2;
}
