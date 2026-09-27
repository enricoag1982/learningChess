/**
 * Plays any `ExerciseDef` to completion using its own definition as the answer key — no solver
 * involved: the content build (or the caller) already proved the authored answer / solutions /
 * target / line is correct; this only proves the engine accepts it end to end. Shared by every
 * `packages/content` playthrough test (World 1, 3, 4, 5).
 */
import { chessJsRules } from '../domain/chess/chessjs-rules.ts';
import { findMoveBySan } from '../domain/chess/facts/san.ts';
import type { Square } from '../domain/chess/types.ts';
import {
  answerChoice,
  answerYesNo,
  placePiece,
  playMateInN,
  playMove,
  selectSquaresAnswer,
  startExercise,
  submitSelection,
  toggleSquare,
} from '../domain/exercise/engine.ts';
import type { ExerciseState } from '../domain/exercise/engine.ts';
import type { ExerciseDef } from '../domain/exercise/types.ts';
import { createVariantRules } from '../domain/variant/rules.ts';
import type { VariantRules } from '../domain/variant/rules.ts';

const defaultRules = createVariantRules(chessJsRules);

/**
 * Plays `def` to a solved (or thrown) end, using `rules` (default: standard variant rules over
 * `chessJsRules`, static opponent) for every type except `mate-in-n`, which is real chess (both
 * kings, real turn alternation) and always uses `chessJsRules` directly, scripted move by move.
 */
export function playExerciseToCompletion(
  def: ExerciseDef,
  rules: VariantRules = defaultRules,
): ExerciseState {
  const state = startExercise(def);
  switch (def.type) {
    case 'select-squares': {
      const answer = selectSquaresAnswer(def, rules);
      const selected = answer.reduce((s, square) => toggleSquare(s, square), state);
      return submitSelection(selected, rules).state;
    }
    case 'yes-no':
      return answerYesNo(state, def.answer);
    case 'choice':
      return answerChoice(state, def.answer);
    case 'setup':
      // Only the squares the exercise actually adds: `target` also repeats whatever `position`
      // already has placed (checkSetupShape requires `position` ⊆ `target`), and placing an
      // already-filled square again is a wrong try (engine.ts: `placePiece`), not a no-op.
      return Object.entries(def.target.pieces).reduce((s, [square, piece]) => {
        if (def.position.pieces[square as Square] !== undefined) return s;
        return placePiece(s, square as Square, piece).state;
      }, state);
    case 'best-move': {
      const [solutionSan] = def.solutions;
      if (solutionSan === undefined) {
        throw new Error(`best-move exercise "${def.id}" has no solutions`);
      }
      const candidates = rules.legalMoves(def.position, { staticOpponent: true });
      const move = findMoveBySan(candidates, solutionSan);
      if (move === undefined) {
        throw new Error(`best-move exercise "${def.id}": no legal move matches "${solutionSan}"`);
      }
      return playMove(state, rules, { from: move.from, to: move.to, promotion: move.promotion })
        .state;
    }
    case 'mate-in-n': {
      let current = state;
      for (const san of def.line) {
        const candidates = chessJsRules.legalMoves(current.position);
        const move = findMoveBySan(candidates, san);
        if (move === undefined) {
          throw new Error(`mate-in-n exercise "${def.id}": no legal move matches "${san}"`);
        }
        const { state: next } = playMateInN(current, chessJsRules, {
          from: move.from,
          to: move.to,
          promotion: move.promotion,
        });
        current = next;
        if (current.solved) break; // the mating move solves it before a further scripted reply
      }
      return current;
    }
    default:
      throw new Error(`playExerciseToCompletion: unsupported exercise type "${def.type}"`);
  }
}
