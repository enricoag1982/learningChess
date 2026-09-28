import { enemyCount, type CaptureDef } from '../../chess.ts';
import { z } from 'zod';
import { checkOptimalMoves, exerciseCommonFields } from '../../content/kinds/common.ts';
import type { ExerciseKindContent } from '@learn/platform-content/kinds/kind-content';
import type { CompileContext } from '@learn/platform-content/kinds/kind-content';

/** Capture every opponent piece (opponent is static); `stars3`/`stars2` are move-count thresholds. */
export const schema = z
  .object({
    ...exerciseCommonFields,
    type: z.literal('capture'),
    stars3: z.number().int().positive(),
    /** Defaults to `stars3 + 1` when absent. */
    stars2: z.number().int().positive().optional(),
  })
  .strict();

function compile(raw: z.output<typeof schema>, ctx: CompileContext): CaptureDef {
  return ctx.build({ type: 'capture', stars3: raw.stars3, stars2: raw.stars2 ?? raw.stars3 + 1 });
}

/** An opponent piece must exist, and `stars3`/`stars2` must match the solver (`checkOptimalMoves`). */
function verify(exercise: CaptureDef, where: string, issues: string[]): void {
  if (enemyCount(exercise.position, exercise.position.toMove) === 0) {
    issues.push(`${where}: capture exercise has no opponent piece`);
  }
  checkOptimalMoves(exercise, where, issues);
}

export const capture: ExerciseKindContent<CaptureDef, typeof schema> = {
  type: 'capture',
  schema,
  compile,
  verify,
};
