// The exercise-kind e2e-driver registry: the only place exercise-type dispatch happens for e2e. `Page` is type-only; this
// file (and each kind's `e2e.ts`) is never reachable from app code, only Playwright specs (eslint.config.js).
import type { Page } from '@playwright/test';
import type { MathExerciseDef, MathState } from '../../core/types.ts';
import { choiceE2E } from '../../kinds/choice/e2e.ts';
import type { ActionOf, DefOf, ExerciseType, MathAction, MathOutcome } from '../../kinds/index.ts';
import { numberEntryE2E } from '../../kinds/number-entry/e2e.ts';

/** One kind's e2e driver: reproduces a core `action` (already applied purely, `outcome` / `before` known) as taps / clicks on the page. */
export interface KindE2E<
  D extends MathExerciseDef = MathExerciseDef,
  A extends { readonly type: string } = MathAction,
  O = MathOutcome,
> {
  perform(
    page: Page,
    action: A,
    ctx: {
      readonly def: D;
      readonly before: MathState<D>;
      readonly outcome: O;
      readonly text: (key: string) => string;
    },
  ): Promise<void>;
}

export const EXERCISE_KIND_E2E = {
  choice: choiceE2E,
  'number-entry': numberEntryE2E,
} satisfies {
  readonly [T in ExerciseType]: KindE2E<DefOf<T>, ActionOf<T>>;
};

/** `type`'s driver, widened: `perform` is a method, so its parameters widen (bivariance) with no cast. */
export function kindE2EOf(type: ExerciseType): KindE2E {
  return EXERCISE_KIND_E2E[type];
}
