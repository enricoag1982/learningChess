import { enemyCount, type CaptureDef } from '@chess-kids/core';
import { checkOptimalMoves } from '../common.ts';

/** An opponent piece must exist, and `stars3`/`stars2` must match the solver (`checkOptimalMoves`). */
export function verify(exercise: CaptureDef, where: string, issues: string[]): void {
  if (enemyCount(exercise.position, exercise.position.toMove) === 0) {
    issues.push(`${where}: capture exercise has no opponent piece`);
  }
  checkOptimalMoves(exercise, where, issues);
}
