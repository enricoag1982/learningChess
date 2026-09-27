/**
 * The mini-game-mode content abstraction (schema + compile + verify): a uniform interface so
 * `lesson-load.ts` dispatches through a registry (`modes/index.ts`) instead of its own `mode`-by-
 * mode `if` chain — the content counterpart of core's `MiniGameMode`.
 */
import type { ExerciseDef, MiniGame, Position } from '@chess-kids/core';
import type { z } from 'zod';
import { compileExercises } from '../kinds/compile-exercise.ts';
import { compilePosition, type PositionYaml } from '../kinds/common.ts';
import type { ExerciseYaml } from '../kinds/index.ts';

/**
 * Per-mini-game compile helper: `ctx.position` parses a board/FEN field (`static`/`versus`'s own),
 * `ctx.exercises` compiles an exercise array field the same way a lesson's own are (`series`'
 * `rounds`).
 */
export interface MiniGameCompileContext {
  readonly issues: string[];
  position(field: string, raw: PositionYaml): Position | null;
  exercises(
    field: string,
    raw: readonly ExerciseYaml[],
    concept: string,
  ): readonly ExerciseDef[] | null;
}

/** Builds the `MiniGameCompileContext` for one mini-game file (`lesson-load.ts`'s generic loader). */
export function makeMiniGameCompileContext(
  relPath: string,
  issues: string[],
): MiniGameCompileContext {
  return {
    issues,
    position(field, raw) {
      return compilePosition(relPath, field, raw, issues);
    },
    exercises(field, raw, concept) {
      return compileExercises(relPath, field, raw, concept, issues);
    },
  };
}

/**
 * Semantic-check helpers every mode's `verify` needs, so each keeps today's check order without
 * repeating the lesson-level logic they share: `claimId` (cross-file id dedup), `checkTextKey`,
 * `checkExercise` (a `series` round's full per-exercise check — text key, kid piece, kind shape),
 * and `hasKidPiece`. `issues` is the shared sink every check (including a mode's own bespoke ones,
 * e.g. "par is …") pushes to.
 */
export interface ModeVerifyContext {
  readonly issues: string[];
  claimId(id: string, where: string): void;
  checkTextKey(fullKey: string, where: string): void;
  checkExercise(exercise: ExerciseDef, where: string): void;
  hasKidPiece(position: Position): boolean;
}

/**
 * One mini-game mode's content behaviour. Method syntax (not arrow-typed fields) is deliberate,
 * same reason as `ExerciseKindContent`: bivariant params let a precise mode widen to
 * `AnyMiniGameModeContent` with no `any`/cast.
 */
export interface MiniGameModeContent<G extends MiniGame, S extends z.ZodType> {
  readonly mode: G['mode'];
  readonly schema: S;
  compile(raw: z.output<S>, ctx: MiniGameCompileContext): G | null;
  verify(game: G, where: string, ctx: ModeVerifyContext): void;
  /** This mode's own exercises (`series`' `rounds`), for the voice inventory and the semantics
   * loop — omitted where a mode has none (`static`, `versus`). */
  exercises?(game: G): readonly ExerciseDef[];
}
