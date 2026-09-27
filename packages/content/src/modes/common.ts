/** Fields shared by every mini-game mode's schema (`modes/<mode>/schema.ts`). */
import { textRefSchema } from '../kinds/common.ts';
import { keySchema } from '../schema.ts';

export const miniGameCommonFields = {
  id: keySchema,
  concept: keySchema,
  unlockAfter: keySchema,
  title: textRefSchema,
  goal: textRefSchema,
};
