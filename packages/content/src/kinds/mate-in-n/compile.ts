import type { MateInNDef } from '@chess-kids/core';
import type { z } from 'zod';
import type { CompileContext } from '../kind-content.ts';
import type { schema } from './schema.ts';
import { checkMateInNTrap } from './verify.ts';

export function compile(raw: z.output<typeof schema>, ctx: CompileContext): MateInNDef {
  const exercise: MateInNDef = ctx.build({ type: 'mate-in-n', n: raw.n, line: raw.line });
  checkMateInNTrap(exercise, raw.trap, ctx.where, ctx.issues);
  return exercise;
}
