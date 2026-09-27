import type { CollectStarsDef } from '@chess-kids/core';
import { checkOptimalMoves } from '../common.ts';

/** A star must exist, and `stars3`/`stars2` must match the solver (`checkOptimalMoves`). */
export function verify(exercise: CollectStarsDef, where: string, issues: string[]): void {
  if (exercise.position.markers.stars.length === 0) {
    issues.push(`${where}: collect-stars exercise has no star`);
  }
  checkOptimalMoves(exercise, where, issues);
}
