import type { SeriesMiniGame } from '@chess-kids/core';
import type { z } from 'zod';
import type { MiniGameCompileContext } from '../mode-content.ts';
import type { schema } from './schema.ts';

export function compile(
  raw: z.output<typeof schema>,
  ctx: MiniGameCompileContext,
): SeriesMiniGame | null {
  const rounds = ctx.exercises('rounds', raw.rounds, raw.concept);
  if (rounds === null) {
    return null;
  }
  return {
    mode: 'series',
    id: raw.id,
    concept: raw.concept,
    rounds,
    errors3: raw.errors3,
    errors2: raw.errors2,
    titleKey: `lessons:${raw.title}`,
    goalKey: `lessons:${raw.goal}`,
    unlockAfter: raw.unlockAfter,
  };
}
