// The exercise-kind content abstraction (schema + compile + verify): a uniform interface so
// `lesson-load.ts` dispatches through a registry (`kinds/index.ts`) — the content counterpart of
// core's `ExerciseKind`.
import type { TextKeyRef } from '@chess-kids/core';
import type { ExerciseDef } from '@chess-kids/core/chess';
import type { z } from 'zod';

/** Fields every compiled exercise def shares, supplied by `CompileContext.build` ahead of the
 * subject's own stimulus head and the kind's own body. */
interface GenericHead {
  readonly id: string;
  readonly concept: string;
  readonly textKey: string;
}

/** Per-exercise compile helpers, threaded through a kind's `compile(raw, ctx)`: `ctx.where` is
 * `<relPath>: <fieldPath>`, `ctx.issues` collects them, and `ctx.build` prepends the generic and
 * subject head fields and appends `easier` and the subject's tail fields every exercise shares.
 * `D` (each kind's own concrete def) is inferred from the caller's own return type. */
export interface CompileContext {
  readonly where: string;
  readonly issues: string[];
  // D is inferred from each kind's own `compile`'s declared return type, not from `body`.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  build<D extends { readonly type: string }>(body: object): D;
}

/** Builds the `CompileContext` for one exercise (`kinds/compile-exercise.ts`'s generic compiler);
 * `stimulus` is the subject's own `head`/`tail` for this exercise (`StimulusContent.compile`'s
 * result), spliced in at the position `docs/refactor-v4.md` fixes: id, concept, textKey, [head],
 * body, easier, [tail]. */
export function makeCompileContext(
  relPath: string,
  fieldPath: string,
  issues: string[],
  head: GenericHead,
  easier: string | undefined,
  stimulus: { readonly head: object; readonly tail: object },
): CompileContext {
  return {
    where: `${relPath}: ${fieldPath}`,
    issues,
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- see above.
    build<D extends { readonly type: string }>(body: object): D {
      // Single trust boundary from the generic bag to each kind's own concrete def — same idiom
      // as every other platform/subject seam.
      return {
        ...head,
        ...stimulus.head,
        ...body,
        ...(easier === undefined ? {} : { easier }),
        ...stimulus.tail,
      } as unknown as D;
    },
  };
}

/** One exercise type's content behaviour: `schema`, `refine` (union-level cross-field check),
 * `compile` (YAML → `ExerciseDef`), `verify`, and `needsKidPiece` (default `true`). Method syntax
 * is deliberate: bivariant params let a precise kind widen with no cast. */
export interface ExerciseKindContent<D extends ExerciseDef, S extends z.ZodType> {
  readonly type: D['type'];
  readonly schema: S;
  refine?(raw: z.output<S>, ctx: z.RefinementCtx): void;
  compile(raw: z.output<S>, ctx: CompileContext): D | null;
  verify?(def: D, where: string, issues: string[]): void;
  needsKidPiece?(def: D): boolean;
  /** Text keys `def` references besides its own `textKey` (e.g. a `choice` option's). */
  textKeys?(def: D): readonly TextKeyRef[];
}
