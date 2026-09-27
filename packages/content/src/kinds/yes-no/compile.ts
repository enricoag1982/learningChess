import type { Square, YesNoDef } from '@chess-kids/core';
import type { z } from 'zod';
import type { CompileContext } from '../kind-content.ts';
import type { schema } from './schema.ts';
import { checkYesNoVerify } from './verify.ts';

export function compile(raw: z.output<typeof schema>, ctx: CompileContext): YesNoDef {
  const exercise: YesNoDef = ctx.build({
    type: 'yes-no',
    answer: raw.answer === 'yes',
    ...(raw.focus === undefined ? {} : { focus: raw.focus as Square }),
  });
  checkYesNoVerify(exercise, raw.verify, ctx.where, ctx.issues);
  return exercise;
}
