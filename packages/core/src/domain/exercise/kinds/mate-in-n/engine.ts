import type { ChessRules, MoveInput } from '../../../chess/rules.ts';
import { findMoveBySan, sameSan } from '../../../chess/facts/san.ts';
import type { VariantRules } from '../../../variant/rules.ts';
import type { ExerciseState } from '../../engine.ts';
import type { Hint } from '../../hint.ts';
import type { MateInNDef, MateInNOutcome } from './def.ts';

/**
 * Plays a kid move for a `mate-in-n` exercise, under real chess rules (both kings, real turn
 * alternation — never a static opponent, unlike every other move-playing exercise type). A move
 * that delivers checkmate always solves it, even when it is not the scripted one; otherwise the
 * move must match the scripted line for this ply, and its scripted opponent reply (if any) is
 * applied automatically so the kid's turn comes right back around. `undo` is not offered for this
 * type (like `best-move`).
 */
export function playMateInN(
  state: ExerciseState,
  rules: ChessRules,
  move: MoveInput,
): { readonly state: ExerciseState; readonly outcome: MateInNOutcome } {
  if (state.def.type !== 'mate-in-n') {
    throw new Error('playMateInN: exercise is not mate-in-n');
  }
  if (state.solved) {
    return { state, outcome: { kind: 'illegal' } };
  }
  const def = state.def;

  const played = rules.play(state.position, move);
  if (played === null) {
    return { state: { ...state, errors: state.errors + 1 }, outcome: { kind: 'illegal' } };
  }

  if (rules.status(played.position).checkmate) {
    const nextState: ExerciseState = {
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
  const nextState: ExerciseState = {
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
  state: ExerciseState,
  def: MateInNDef,
  rules: VariantRules,
  level: 1 | 2 | 3,
): Hint {
  const san = def.line[state.history.length];
  const candidates = rules.legalMoves(state.position, { staticOpponent: true });
  const move = san === undefined ? undefined : findMoveBySan(candidates, san);
  if (level === 1) {
    return { kind: 'squares', level: 1, squares: move === undefined ? [] : [move.from] };
  }
  if (level === 2) {
    return { kind: 'squares', level: 2, squares: move === undefined ? [] : [move.to] };
  }
  return {
    kind: 'squares',
    level: 3,
    squares: move === undefined ? [] : [move.from, move.to],
    ...(move === undefined ? {} : { move: { from: move.from, to: move.to } }),
  };
}
