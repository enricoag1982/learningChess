/**
 * The exercise-kind content abstraction (schema + compile + verify): a uniform interface so
 * `lesson-load.ts` dispatches through a registry (`kinds/index.ts`) instead of its own `type`-by-
 * type `if` chain — the content counterpart of core's `ExerciseKind`.
 */
import type { ExerciseDef, Position, Square } from '@chess-kids/core';
import type { z } from 'zod';
import { compilePosition, type PositionYaml } from './common.ts';

/** Fields every compiled `ExerciseDef` shares, supplied by `CompileContext.build` (the "head"). */
interface CompiledHead {
  readonly id: string;
  readonly concept: string;
  readonly textKey: string;
  readonly position: Position;
}

/** Fields every compiled `ExerciseDef` may carry, appended by `CompileContext.build` (the "tail"). */
interface CompiledTail {
  readonly easier?: string;
  readonly lastMove?: { readonly from: Square; readonly to: Square };
}

/**
 * Per-exercise compile helpers, threaded through a kind's `compile(raw, ctx)`: `ctx.where` is
 * `<relPath>: <fieldPath>` (for issue messages the kind builds itself), `ctx.issues` collects them,
 * `ctx.position` parses a further board/FEN field (e.g. `setup`'s `target`), and `ctx.build` prepends
 * the head (`id`/`concept`/`textKey`/`position`) and appends the tail (`easier`/`lastMove`) that
 * every exercise shares, so a kind's own `compile` only ever states its own type-specific fields.
 */
export interface CompileContext {
  readonly where: string;
  readonly issues: string[];
  position(field: string, raw: PositionYaml): Position | null;
  build<B extends { readonly type: string }>(body: B): CompiledHead & B & CompiledTail;
}

/** Builds the `CompileContext` for one exercise (`lesson-load.ts`'s generic exercise compiler). */
export function makeCompileContext(
  relPath: string,
  fieldPath: string,
  issues: string[],
  head: Omit<CompiledHead, 'position'> & { readonly position: Position },
  tail: CompiledTail,
): CompileContext {
  return {
    where: `${relPath}: ${fieldPath}`,
    issues,
    position(field, raw) {
      return compilePosition(relPath, `${fieldPath}.${field}.board`, raw, issues);
    },
    build(body) {
      return {
        ...head,
        ...body,
        ...(tail.easier === undefined ? {} : { easier: tail.easier }),
        ...(tail.lastMove === undefined ? {} : { lastMove: tail.lastMove }),
      };
    },
  };
}

/**
 * One exercise type's content behaviour: `schema` (zod, `kinds/<type>/schema.ts`), `refine` (the
 * union-level cross-field check `lesson-schema.ts` used to run inline, by `type`), `compile` (YAML →
 * `ExerciseDef`, `kinds/<type>/compile.ts`), `verify` (semantic/shape checks on the compiled def,
 * `kinds/<type>/verify.ts` — today's `checkExerciseShape` branch), and `needsKidPiece` (default
 * `true`; `setup` and `select-squares` with an explicit `squares` answer need none). Parameterised
 * on `D` (not `T`, its `type` field) like core's `ExerciseKind<Def, ...>`: method syntax (not
 * arrow-typed fields) is deliberate — bivariant params let a precise kind widen to
 * `AnyExerciseKindContent` with no `any`/cast.
 */
export interface ExerciseKindContent<D extends ExerciseDef, S extends z.ZodType> {
  readonly type: D['type'];
  readonly schema: S;
  refine?(raw: z.output<S>, ctx: z.RefinementCtx): void;
  compile(raw: z.output<S>, ctx: CompileContext): D | null;
  verify?(def: D, where: string, issues: string[]): void;
  needsKidPiece?(def: D): boolean;
}
