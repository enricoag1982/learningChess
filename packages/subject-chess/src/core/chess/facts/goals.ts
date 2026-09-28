import type { Color, Position } from '../types.ts';

/** Count of pieces not belonging to `kidColor` (the static-opponent side, whichever one that is). */
export function enemyCount(position: Position, kidColor: Color): number {
  return Object.values(position.pieces).filter((piece) => piece.color !== kidColor).length;
}

/** A static-opponent mini-game / exercise win condition. */
export type Goal = 'collect-stars' | 'capture';

/** True when `position` already satisfies `goal` for `kidColor`. */
export function isGoalReached(position: Position, goal: Goal, kidColor: Color): boolean {
  if (goal === 'collect-stars') {
    return position.markers.stars.length === 0;
  }
  return enemyCount(position, kidColor) === 0;
}
