// The mini-game-mode content abstraction (schema + compile + verify): a uniform interface so
// `lesson-load.ts` dispatches through a registry (`modes/index.ts`) — the content counterpart of
// core's `MiniGameMode`.
import type { ExerciseDefBase, MiniGameBase } from '@chess-kids/core';
import type { z } from 'zod';
import { compileExercises } from '../kinds/compile-exercise.ts';
import type { AnyExerciseKindContent } from '../kinds/kind-content.ts';
import type { ExerciseYamlBase, StimulusContent } from '../subject.ts';

/** Per-mini-game compile helper: `relPath` for a mode's own position field (chess: `static`,
 * `versus`, compiling it directly, being chess-bound content themselves); `exercises` compiles an
 * exercise array field the same way a lesson's own are (`series`' `rounds`). */
export interface MiniGameCompileContext {
  readonly relPath: string;
  readonly issues: string[];
  exercises(
    field: string,
    raw: readonly ExerciseYamlBase[],
    concept: string,
  ): readonly ExerciseDefBase[] | null;
}

/** Builds the `MiniGameCompileContext` for one mini-game file (`lesson-load.ts`'s generic loader). */
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

/** Semantic-check helpers every mode's `verify` needs, without repeating the lesson-level logic
 * they share: `claimId`, `checkTextKey`, `checkExercise`. `issues` is the shared sink. */
export interface ModeVerifyContext {
  readonly issues: string[];
  claimId(id: string, where: string): void;
  checkTextKey(fullKey: string, where: string): void;
  checkExercise(exercise: ExerciseDefBase, where: string): void;
}

/** One mini-game mode's content behaviour. Method syntax is deliberate, same reason as
 * `ExerciseKindContent`: bivariant params let a precise mode widen with no cast. */
export interface MiniGameModeContent<G extends MiniGameBase, S extends z.ZodType> {
  readonly mode: G['mode'];
  readonly schema: S;
  compile(raw: z.output<S>, ctx: MiniGameCompileContext): G | null;
  verify(game: G, where: string, ctx: ModeVerifyContext): void;
  /** This mode's own exercises (`series`' `rounds`), for the voice inventory and the semantics
   * loop — omitted where a mode has none (`static`, `versus`). */
  exercises?(game: G): readonly ExerciseDefBase[];
}

/** Any mini-game mode's content, widened to the base state shape (`SubjectContent.modes`'s own
 * entries); each concrete mode (chess: `MiniGameModeContent<SeriesMiniGame, ...>`) widens to this. */
export type AnyMiniGameModeContent = MiniGameModeContent<MiniGameBase, z.ZodType>;
