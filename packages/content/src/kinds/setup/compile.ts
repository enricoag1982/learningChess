import type { SetupDef } from '@chess-kids/core';
import type { z } from 'zod';
import type { CompileContext } from '../kind-content.ts';
import type { schema } from './schema.ts';

export function compile(raw: z.output<typeof schema>, ctx: CompileContext): SetupDef | null {
  const target = ctx.position('target', raw.target);
  if (target === null) {
    return null;
  }
  return ctx.build({ type: 'setup' as const, target });
}
