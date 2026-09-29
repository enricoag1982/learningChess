import type { StaticMiniGame } from '../../core/chess/lesson.ts';
import { hasPieceOf } from '../../core/chess/facts/pieces.ts';
import { optimalMoves } from '../../core/exercise/solver.ts';
import { staticGoalExercise } from './def.ts';
import { z } from 'zod';
import {
  checkExactlyOnePosition,
  compilePosition,
  positionFields,
  rules,
} from '../../content/kinds/common.ts';
import { miniGameCommonFields } from '@learn/platform-content/modes/common';
import type {
  MiniGameCompileContext,
  MiniGameModeContent,
  ModeVerifyContext,
} from '@learn/platform-content/modes/mode-content';

/** A `static` mini-game (the default `mode`): `type` is the win condition (`capture-all`, default, or `collect-stars`); `goal`
 * is the spoken-text key for the in-game goal line. */
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
  const position = compilePosition(raw, { where: `${ctx.relPath}: board`, issues: ctx.issues });
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
    titleKey: `lessons:${raw.title ?? `${raw.id}.title`}`,
    goalKey: `lessons:${raw.goal ?? `${raw.id}.goal`}`,
    unlockAfter: raw.unlockAfter,
  };
}

function verify(miniGame: StaticMiniGame, where: string, ctx: ModeVerifyContext): void {
  if (!hasPieceOf(miniGame.position, miniGame.position.toMove)) {
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
