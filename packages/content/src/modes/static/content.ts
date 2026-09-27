import { optimalMoves, staticGoalExercise, type StaticMiniGame } from '@chess-kids/core';
import { z } from 'zod';
import { checkExactlyOnePosition, positionFields, rules } from '../../kinds/common.ts';
import { miniGameCommonFields } from '../common.ts';
import type {
  MiniGameCompileContext,
  MiniGameModeContent,
  ModeVerifyContext,
} from '../mode-content.ts';

/**
 * A `static` mini-game (default `mode`, back-compat with every file authored before per-kind
 * modes): `type` is the win condition (`capture-all`, the default, or `collect-stars`); `goal` is
 * the spoken-text key for the goal line shown in-game.
 */
export const schema = z
  .object({
    ...miniGameCommonFields,
    mode: z.literal('static').optional(),
    type: z.enum(['capture-all', 'collect-stars']).optional(),
    ...positionFields,
    par: z.number().int().positive(),
    moveLimit: z.number().int().positive(),
  })
  .strict()
  .superRefine(checkExactlyOnePosition);

function compile(raw: z.output<typeof schema>, ctx: MiniGameCompileContext): StaticMiniGame | null {
  const position = ctx.position('board', raw);
  if (position === null) {
    return null;
  }
  return {
    mode: 'static',
    id: raw.id,
    concept: raw.concept,
    position,
    goal: raw.type ?? 'capture-all',
    par: raw.par,
    moveLimit: raw.moveLimit,
    titleKey: `lessons:${raw.title}`,
    goalKey: `lessons:${raw.goal}`,
    unlockAfter: raw.unlockAfter,
  };
}

function verify(miniGame: StaticMiniGame, where: string, ctx: ModeVerifyContext): void {
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

export const staticMode: MiniGameModeContent<StaticMiniGame, typeof schema> = {
  mode: 'static',
  schema,
  compile,
  verify,
};
