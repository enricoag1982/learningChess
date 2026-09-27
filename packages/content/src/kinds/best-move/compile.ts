import type { BestMoveDef } from '@chess-kids/core';
import type { z } from 'zod';
import type { CompileContext } from '../kind-content.ts';
import type { schema } from './schema.ts';
import { checkBestMoveVerify } from './verify.ts';

export function compile(raw: z.output<typeof schema>, ctx: CompileContext): BestMoveDef {
  const exercise: BestMoveDef = ctx.build({ type: 'best-move', solutions: raw.solutions });
  checkBestMoveVerify(exercise, raw.verify, ctx.where, ctx.issues);
  return exercise;
}
