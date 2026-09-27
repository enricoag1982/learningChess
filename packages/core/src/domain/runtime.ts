// `createSubjectRuntime` (design-r4.md §2): builds a subject's kind + mode registries for platform
// code, adding the platform `series` mode over the subject's own kinds — the seam leak #3 needed
// (`kinds/index.ts`, `modes/index.ts` and `modes/series/engine.ts` no longer hardcode chess).
import { createSeriesMode } from './exercise/modes/series/mode.ts';
import type { AnyKind, AnyMode, SubjectCore } from './subject.ts';

/** A subject's kind + mode registries, ready for platform code to dispatch through — never a
 * hardcoded chess import. `rewards` passes through unchanged (leak #4, `app/rewards.ts`). */
export interface SubjectRuntime<Ctx = unknown, F = unknown> {
  readonly kinds: Readonly<Record<string, AnyKind<Ctx>>>;
  readonly modes: Readonly<Record<string, AnyMode>>;
  readonly rewards?: SubjectCore<Ctx, F>['rewards'];
}

/** Builds `core`'s runtime: its own kinds, its own modes plus the platform `series` mode (built
 * over those same kinds). */
export function createSubjectRuntime<Ctx, F = unknown>(
  core: SubjectCore<Ctx, F>,
): SubjectRuntime<Ctx, F> {
  return {
    kinds: core.kinds,
    modes: { ...core.modes, series: createSeriesMode(core.kinds) },
    rewards: core.rewards,
  };
}
