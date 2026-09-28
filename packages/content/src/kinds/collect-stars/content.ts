import type { CollectStarsDef } from '@chess-kids/core/chess';
import { z } from 'zod';
import { checkOptimalMoves, exerciseCommonFields } from '../common.ts';
import type { ExerciseKindContent } from '../kind-content.ts';
import type { CompileContext } from '../kind-content.ts';

/** Move a piece over every star; `stars3`/`stars2` are move-count thresholds. */
export const schema = z
  .object({
    ...exerciseCommonFields,
    type: z.literal('collect-stars'),
    stars3: z.number().int().positive(),
    /** Defaults to `stars3 + 1` when absent. */
    stars2: z.number().int().positive().optional(),
  })
  .strict();

function compile(raw: z.output<typeof schema>, ctx: CompileContext): CollectStarsDef {
  return ctx.build({
    type: 'collect-stars',
    stars3: raw.stars3,
    stars2: raw.stars2 ?? raw.stars3 + 1,
  });
}

/** A star must exist, and `stars3`/`stars2` must match the solver (`checkOptimalMoves`). */
function verify(exercise: CollectStarsDef, where: string, issues: string[]): void {
  if (exercise.position.markers.stars.length === 0) {
    issues.push(`${where}: collect-stars exercise has no star`);
  }
  checkOptimalMoves(exercise, where, issues);
}

export const collectStars: ExerciseKindContent<CollectStarsDef, typeof schema> = {
  type: 'collect-stars',
  schema,
  compile,
  verify,
};
