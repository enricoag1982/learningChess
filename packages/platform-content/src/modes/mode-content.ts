// Mini-game-mode content abstraction (schema + compile + verify): `lesson-load.ts` dispatches through a registry
// (`modes/index.ts`), the content counterpart of core's `MiniGameMode`.
import type { ExerciseDefBase, MiniGameBase } from '@learn/platform-core';
import type { z } from 'zod';
import { compileExercises } from '../kinds/compile-exercise.ts';
import type { AnyExerciseKindContent } from '../kinds/kind-content.ts';
import type { ExerciseYamlBase, StimulusContent } from '../subject.ts';

/** `relPath` for a mode's own position field (chess: `static`, `versus`, compiled directly); `exercises` compiles an
 * exercise array like a lesson's (`series`' `rounds`). */
export interface MiniGameCompileContext {
  readonly relPath: string;
  readonly issues: string[];
  exercises(
    field: string,
    raw: readonly ExerciseYamlBase[],
    concept: string,
  ): readonly ExerciseDefBase[] | null;
}

export function makeMiniGameCompileContext(
  relPath: string,
  kinds: Readonly<Record<string, AnyExerciseKindContent>>,
  stimulus: StimulusContent,
  issues: string[],
): MiniGameCompileContext {
  return {
    relPath,
    issues,
    exercises(field, raw, concept) {
      return compileExercises(relPath, field, raw, concept, stimulus, kinds, issues);
    },
  };
}

/** Helpers for a mode's `verify`, sharing the lesson-level logic: `claimId`, `checkExercise`; `issues` is the shared sink. */
export interface ModeVerifyContext {
  readonly issues: string[];
  claimId(id: string, where: string): void;
  checkExercise(exercise: ExerciseDefBase, where: string): void;
}

/** One mini-game mode's content behaviour. Method syntax: bivariance lets a precise mode widen with no cast. */
export interface MiniGameModeContent<G extends MiniGameBase, S extends z.ZodType> {
  readonly mode: G['mode'];
  readonly schema: S;
  compile(raw: z.output<S>, ctx: MiniGameCompileContext): G | null;
  verify(game: G, where: string, ctx: ModeVerifyContext): void;
  /** This mode's own exercises (`series`' `rounds`), for the voice inventory and the semantics
   * loop — omitted where a mode has none (`static`, `versus`). */
  exercises?(game: G): readonly ExerciseDefBase[];
}

/** What every mode's file shares for the generic loader: `mode` picks the mode (absent = the subject's `defaultMode`). */
export interface MiniGameYamlBase {
  readonly mode?: string;
}

export type MiniGameSchema = z.ZodType<MiniGameYamlBase>;

/** Widened to the base state shape (`SubjectContent.modes` entries); concrete modes widen to it. */
export type AnyMiniGameModeContent = MiniGameModeContent<MiniGameBase, MiniGameSchema>;
