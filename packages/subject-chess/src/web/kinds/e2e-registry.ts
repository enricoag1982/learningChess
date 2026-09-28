// The exercise-kind e2e-driver registry — the only place exercise-type dispatch happens for e2e.
// `Page` is a type-only import: this file (and every kind's own `e2e.ts`) is never reachable from
// app code, only from Playwright specs (`e2e/kit/exercises.ts`), enforced by eslint.config.js.
import type { Page } from '@playwright/test';
import type {
  ActionOf,
  DefOf,
  ExerciseStateOf,
  ExerciseType,
  OutcomeOf,
  VariantRules,
} from '../../chess.ts';
import { bestMoveE2E } from '../../kinds/best-move/e2e.ts';
import { captureE2E } from '../../kinds/capture/e2e.ts';
import { choiceE2E } from '../../kinds/choice/e2e.ts';
import { collectStarsE2E } from '../../kinds/collect-stars/e2e.ts';
import { mateInNE2E } from '../../kinds/mate-in-n/e2e.ts';
import { selectSquaresE2E } from '../../kinds/select-squares/e2e.ts';
import { setupE2E } from '../../kinds/setup/e2e.ts';
import { yesNoE2E } from '../../kinds/yes-no/e2e.ts';

/** One exercise kind's e2e driver: reproduces a core `action` (already applied purely, its
 * `outcome`/`before` known) as taps/clicks on the rendered page. */
export interface KindE2E<T extends ExerciseType> {
  perform(
    page: Page,
    action: ActionOf<T>,
    ctx: {
      readonly def: DefOf<T>;
      readonly before: ExerciseStateOf<DefOf<T>>;
      readonly outcome: OutcomeOf<T>;
      readonly rules: VariantRules;
      readonly text: (key: string) => string;
    },
  ): Promise<void>;
}

/** Every exercise type's e2e driver, by `type`. */
export const EXERCISE_KIND_E2E = {
  'collect-stars': collectStarsE2E,
  capture: captureE2E,
  'select-squares': selectSquaresE2E,
  'yes-no': yesNoE2E,
  choice: choiceE2E,
  'best-move': bestMoveE2E,
  setup: setupE2E,
  'mate-in-n': mateInNE2E,
} satisfies { readonly [T in ExerciseType]: KindE2E<T> };

/** `type`'s own e2e driver, widened — same one narrow/widen cast `ui-registry.ts`'s `kindUiOf`
 * uses, for the same reason (`perform`'s `action` is contravariant in `T`). */
export function kindE2EOf(type: ExerciseType): KindE2E<ExerciseType> {
  return EXERCISE_KIND_E2E[type] as KindE2E<ExerciseType>;
}
