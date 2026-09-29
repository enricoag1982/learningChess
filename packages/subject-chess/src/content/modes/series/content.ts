import type { ExerciseDefBase, MiniGameBase, SeriesGameDef } from '@learn/platform-core';
import { z } from 'zod';
import { exerciseSchema } from '../../kinds/index.ts';
import { miniGameCommonFields } from '@learn/platform-content/modes/common';
import type {
  MiniGameCompileContext,
  MiniGameModeContent,
  ModeVerifyContext,
} from '@learn/platform-content/modes/mode-content';

/** A `series` mini-game's compiled content: the platform's round / scoring fields plus the shared catalog fields. */
export type SeriesMiniGame<E extends ExerciseDefBase = ExerciseDefBase> = MiniGameBase &
  SeriesGameDef<E> & { readonly mode: 'series' };

/** A `series` mini-game (Square Hunt, Setup Race, Safe or Not?, …): `rounds` of any exercise type validated like a lesson's,
 * scored on total mistakes across rounds. */
export const schema = z
  .object({
    ...miniGameCommonFields,
    mode: z.literal('series'),
    rounds: z.array(exerciseSchema).min(1),
    errors3: z.number().int().nonnegative(),
    errors2: z.number().int().nonnegative(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.errors2 < value.errors3) {
      ctx.addIssue({
        code: 'custom',
        path: ['errors2'],
        message: '"errors2" must be >= "errors3"',
      });
    }
  });

function compile(raw: z.output<typeof schema>, ctx: MiniGameCompileContext): SeriesMiniGame | null {
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
    titleKey: `lessons:${raw.title ?? `${raw.id}.title`}`,
    goalKey: `lessons:${raw.goal ?? `${raw.id}.goal`}`,
    unlockAfter: raw.unlockAfter,
  };
}

function verify(miniGame: SeriesMiniGame, where: string, ctx: ModeVerifyContext): void {
  for (const [index, round] of miniGame.rounds.entries()) {
    const roundWhere = `${where}: rounds[${String(index)}]`;
    ctx.claimId(round.id, roundWhere);
    ctx.checkExercise(round, roundWhere);
  }
}

export const seriesMode: MiniGameModeContent<SeriesMiniGame, typeof schema> = {
  mode: 'series',
  schema,
  compile,
  verify,
  exercises: (miniGame) => miniGame.rounds,
};
