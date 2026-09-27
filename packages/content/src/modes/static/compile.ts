import type { StaticMiniGame } from '@chess-kids/core';
import type { z } from 'zod';
import type { MiniGameCompileContext } from '../mode-content.ts';
import type { schema } from './schema.ts';

export function compile(
  raw: z.output<typeof schema>,
  ctx: MiniGameCompileContext,
): StaticMiniGame | null {
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
