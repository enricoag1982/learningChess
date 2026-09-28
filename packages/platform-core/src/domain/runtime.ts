// `createSubjectRuntime`: builds a subject's kind + mode registries for platform code, adding the
// platform `series` mode over the subject's own kinds.
import { createSeriesMode } from './exercise/modes/series/mode.ts';
import type { AnyKind, AnyMode, SubjectCore } from './subject.ts';

/** A subject's kind + mode registries, ready for platform code to dispatch through — never a
 * hardcoded chess import. `rewards`/`gameRecordOf` pass through unchanged (leaks #4, #7). */
export interface SubjectRuntime<Ctx = unknown, F = unknown> {
  readonly kinds: Readonly<Record<string, AnyKind<Ctx>>>;
  readonly modes: Readonly<Record<string, AnyMode>>;
  readonly rewards?: SubjectCore<Ctx, F>['rewards'];
  readonly gameRecordOf?: SubjectCore<Ctx, F>['gameRecordOf'];
  readonly settings: SubjectCore<Ctx, F>['settings'];
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
    gameRecordOf: core.gameRecordOf?.bind(core),
    settings: core.settings,
  };
}
