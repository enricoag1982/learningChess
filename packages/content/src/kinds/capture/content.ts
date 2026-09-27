import { enemyCount, type CaptureDef } from '@chess-kids/core';
import { z } from 'zod';
import { checkOptimalMoves, exerciseCommonFields } from '../common.ts';
import type { ExerciseKindContent } from '../kind-content.ts';
import type { CompileContext } from '../kind-content.ts';

/** Capture every opponent piece (opponent is static); `stars3`/`stars2` are move-count thresholds. */
export const schema = z
  .object({
    ...exerciseCommonFields,
    type: z.literal('capture'),
    stars3: z.number().int().positive(),
    stars2: z.number().int().positive(),
  })
  .strict();

function compile(raw: z.output<typeof schema>, ctx: CompileContext): CaptureDef {
  return ctx.build({ type: 'capture', stars3: raw.stars3, stars2: raw.stars2 });
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
