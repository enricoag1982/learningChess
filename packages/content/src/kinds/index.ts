/**
 * The exercise-kind schema registry — the only place exercise-type dispatch happens for schemas.
 * `exerciseSchema` is the discriminated union of every kind's own schema, in today's member order;
 * a kind's optional `refine` runs (via lookup, not a `type` if-chain) after `checkExactlyOnePosition`.
 */
import type { ExerciseType } from '@chess-kids/core';
import { z } from 'zod';
import { checkExactlyOnePosition } from './common.ts';
import { schema as collectStarsSchema } from './collect-stars/schema.ts';
import { schema as captureSchema } from './capture/schema.ts';
import {
  schema as selectSquaresSchema,
  refine as selectSquaresRefine,
} from './select-squares/schema.ts';
import { schema as yesNoSchema } from './yes-no/schema.ts';
import { schema as choiceSchema, refine as choiceRefine } from './choice/schema.ts';
import { schema as bestMoveSchema } from './best-move/schema.ts';
import { schema as setupSchema } from './setup/schema.ts';
import { schema as mateInNSchema } from './mate-in-n/schema.ts';

export type { ChoiceOptionYaml } from './choice/schema.ts';

/** One exercise type's schema, plus its optional union-level `refine` (method syntax: bivariant
 * params let each kind's own precise `z.output<S>` widen here with no `any`/cast). */
interface SchemaEntry<S extends z.ZodType> {
  readonly schema: S;
  refine?(raw: z.output<S>, ctx: z.RefinementCtx): void;
}

type AnySchemaEntry = SchemaEntry<z.ZodType>;

/** Every exercise type's schema entry, by `type` — today's union member order. */
const SCHEMA_ENTRIES: { readonly [T in ExerciseType]: AnySchemaEntry } = {
  'collect-stars': { schema: collectStarsSchema },
  capture: { schema: captureSchema },
  'select-squares': { schema: selectSquaresSchema, refine: selectSquaresRefine },
  'yes-no': { schema: yesNoSchema },
  choice: { schema: choiceSchema, refine: choiceRefine },
  'best-move': { schema: bestMoveSchema },
  setup: { schema: setupSchema },
  'mate-in-n': { schema: mateInNSchema },
};

/** One exercise (`guided` or `exercises` entry), discriminated by `type`. */
export const exerciseSchema = z
  .discriminatedUnion('type', [
    collectStarsSchema,
    captureSchema,
    selectSquaresSchema,
    yesNoSchema,
    choiceSchema,
    bestMoveSchema,
    setupSchema,
    mateInNSchema,
  ])
  .superRefine((raw, ctx) => {
    checkExactlyOnePosition(raw, ctx);
    SCHEMA_ENTRIES[raw.type].refine?.(raw, ctx);
  });
