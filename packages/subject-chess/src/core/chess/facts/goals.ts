import type { Color, Position } from '../types.ts';

export function enemyCount(position: Position, kidColor: Color): number {
  return Object.values(position.pieces).filter((piece) => piece.color !== kidColor).length;
}

export type Goal = 'collect-stars' | 'capture';

export function isGoalReached(position: Position, goal: Goal, kidColor: Color): boolean {
  if (goal === 'collect-stars') {
    return position.markers.stars.length === 0;
  }
  return enemyCount(position, kidColor) === 0;
}
