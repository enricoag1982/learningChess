import { optimalMoves, staticGoalExercise, type StaticMiniGame } from '@chess-kids/core';
import { rules } from '../../kinds/common.ts';
import type { ModeVerifyContext } from '../mode-content.ts';

export function verify(miniGame: StaticMiniGame, where: string, ctx: ModeVerifyContext): void {
  if (!ctx.hasKidPiece(miniGame.position)) {
    ctx.issues.push(`${where}: side to move has no piece`);
  }
  const asExercise = staticGoalExercise({
    id: miniGame.id,
    concept: miniGame.concept,
    textKey: miniGame.titleKey,
    position: miniGame.position,
    goal: miniGame.goal,
    par: miniGame.par,
  });
  if (asExercise.type === 'collect-stars' && miniGame.position.markers.stars.length === 0) {
    ctx.issues.push(`${where}: collect-stars mini-game has no star`);
    return;
  }
  const optimal = optimalMoves(asExercise, rules);
  if (optimal === null) {
    ctx.issues.push(`${where}: no solution found (not solvable within the search depth)`);
    return;
  }
  if (optimal !== miniGame.par) {
    ctx.issues.push(
      `${where}: par is ${String(miniGame.par)} but the optimal solve is ${String(optimal)} move(s)`,
    );
  }
  if (miniGame.moveLimit !== undefined && miniGame.moveLimit <= miniGame.par) {
    ctx.issues.push(
      `${where}: moveLimit (${String(miniGame.moveLimit)}) must be greater than par (${String(miniGame.par)})`,
    );
  }
}
