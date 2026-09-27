import {
  isInCheck,
  selectSquaresAnswer,
  type SelectSquaresDef,
  chessJsRules,
} from '@chess-kids/core';
import { rules } from '../common.ts';

/**
 * `derive: check-escapes` (`lesson-schema.ts`): the side to move's king must actually be in check,
 * and have at least one legal escape square (else the exercise is either unsolvable or not really
 * about escaping check).
 */
function checkCheckEscapesShape(exercise: SelectSquaresDef, where: string, issues: string[]): void {
  if (!isInCheck(exercise.position, chessJsRules)) {
    issues.push(`${where}: check-escapes requires the side to move's king to be in check`);
    return;
  }
  if (selectSquaresAnswer(exercise, rules).length === 0) {
    issues.push(`${where}: check-escapes has no legal king move`);
  }
}

export function verify(exercise: SelectSquaresDef, where: string, issues: string[]): void {
  if ('squares' in exercise.answer) {
    if (exercise.answer.squares.length === 0) {
      issues.push(`${where}: select-squares answer is empty`);
    }
    return;
  }
  if (exercise.answer.derive === 'check-escapes') {
    checkCheckEscapesShape(exercise, where, issues);
    return;
  }
  const fromPiece = exercise.position.pieces[exercise.answer.from];
  if (exercise.answer.derive === 'legal-moves') {
    if (fromPiece === undefined || fromPiece.color !== exercise.position.toMove) {
      issues.push(`${where}: select-squares "from" square has no piece of the side to move`);
    }
    return;
  }
  // attacked-by
  if (fromPiece === undefined) {
    issues.push(`${where}: select-squares "from" square has no piece`);
  }
}
