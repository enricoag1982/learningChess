import type { ChessRules, MoveInput } from '../../core/chess/rules.ts';
import { findMoveBySan, sameSan } from '../../core/chess/facts/san.ts';
import type { VariantRules } from '../../core/variant/rules.ts';
import type { ExerciseStateOf } from '../../core/exercise/state.ts';
import type { Hint } from '../../core/exercise/hint.ts';
import { moveLadderHint } from '../../core/exercise/hint.ts';
import type { MateInNOutcome } from './kind.ts';
import type { MateInNDef } from '../../core/exercise/types.ts';

/** Plays a kid move for a `mate-in-n` exercise, under real chess rules (both kings, real turn
 * alternation). Any move delivering checkmate solves it; otherwise it must match the scripted
 * line, whose opponent reply (if any) is applied automatically. */
export function playMateInN(
  state: ExerciseStateOf<MateInNDef>,
  rules: ChessRules,
  move: MoveInput,
): { readonly state: ExerciseStateOf<MateInNDef>; readonly outcome: MateInNOutcome } {
  if (state.solved) {
    return { state, outcome: { kind: 'illegal' } };
  }
  const def = state.def;

  const played = rules.play(state.position, move);
  if (played === null) {
    return { state: { ...state, errors: state.errors + 1 }, outcome: { kind: 'illegal' } };
  }

  if (rules.status(played.position).checkmate) {
    const nextState: ExerciseStateOf<MateInNDef> = {
      ...state,
      position: played.position,
      history: [...state.history, state.position],
      moves: state.moves + 1,
      solved: true,
    };
    return { state: nextState, outcome: { kind: 'solved', move: played.move } };
  }

  const plyIndex = state.history.length;
  const scriptedSan = def.line[plyIndex];
  if (scriptedSan === undefined || !sameSan(played.move.san, scriptedSan)) {
    return {
      state: { ...state, errors: state.errors + 1 },
      outcome: { kind: 'wrong', move: played.move },
    };
  }

  const replySan = def.line[plyIndex + 1];
  if (replySan === undefined) {
    // The content loader guarantees the line's last move always delivers checkmate; reaching here
    // means it did not, which is a content bug, not a kid error.
    throw new Error(`playMateInN: scripted final move "${scriptedSan}" did not deliver checkmate`);
  }
  const repliedPlay = rules.play(played.position, replySan);
  if (repliedPlay === null) {
    throw new Error(`playMateInN: scripted reply "${replySan}" is illegal`);
  }
  const nextState: ExerciseStateOf<MateInNDef> = {
    ...state,
    position: repliedPlay.position,
    history: [...state.history, state.position, played.position],
    moves: state.moves + 2,
  };
  return {
    state: nextState,
    outcome: { kind: 'moved', move: played.move, reply: repliedPlay.move },
  };
}

/** mate-in-n hint: piece → target square → the move, from the scripted line's move for this ply. */
export function mateInNHint(
  state: ExerciseStateOf<MateInNDef>,
  def: MateInNDef,
  rules: VariantRules,
  level: 1 | 2 | 3,
): Hint {
  const san = def.line[state.history.length];
  const candidates = rules.legalMoves(state.position, { staticOpponent: true });
  return moveLadderHint(san === undefined ? undefined : findMoveBySan(candidates, san), level);
}
