import type { CaptureDef } from '@chess-kids/core';
import type { z } from 'zod';
import type { CompileContext } from '../kind-content.ts';
import type { schema } from './schema.ts';

export function compile(raw: z.output<typeof schema>, ctx: CompileContext): CaptureDef {
  return ctx.build({ type: 'capture', stars3: raw.stars3, stars2: raw.stars2 });
}
