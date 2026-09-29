import { keySchema, textRefSchema } from '../schema.ts';

export const miniGameCommonFields = {
  id: keySchema,
  concept: keySchema,
  unlockAfter: keySchema,
  /** Defaults to `<id>.title` when absent. */
  title: textRefSchema.optional(),
  /** Defaults to `<id>.goal` when absent. */
  goal: textRefSchema.optional(),
};
