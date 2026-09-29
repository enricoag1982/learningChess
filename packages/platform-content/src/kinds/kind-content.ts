// Exercise-kind content abstraction (schema + compile + verify): `lesson-load.ts` dispatches through a registry
// (`kinds/index.ts`), the content counterpart of core's `ExerciseKind`.
import type { ExerciseDefBase, TextKeyRef } from '@learn/platform-core';
import type { z } from 'zod';
import type { ExerciseYamlBase } from '../subject.ts';

/** Fields every compiled def shares, supplied by `CompileContext.build`. */
interface GenericHead {
  readonly id: string;
  readonly concept: string;
  readonly textKey: string;
}

/** Threaded through a kind's `compile(raw, ctx)`: `ctx.where` = `<relPath>: <fieldPath>`, `ctx.issues` collects issues,
 * `ctx.build` adds the generic + subject head fields and `easier` + tail fields. `D` is inferred from the kind's return type. */
export interface CompileContext {
  readonly where: string;
  readonly issues: string[];
  // D is inferred from each kind's own `compile`'s declared return type, not from `body`.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  build<D extends { readonly type: string }>(body: object): D;
}

/** `stimulus` is the subject's `head` / `tail` for this exercise, spliced in at the order `docs/refactor-v4.md` fixes:
 * id, concept, textKey, [head], body, easier, [tail]. */
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

/** One exercise type's content behaviour: `schema`, `refine` (union-level cross-field check), `compile` (YAML → def),
 * `verify`, `checksStimulus` (default `true`). Method syntax: bivariance lets a precise kind widen with no cast. */
export interface ExerciseKindContent<D extends ExerciseDefBase, S extends z.ZodType> {
  readonly type: D['type'];
  readonly schema: S;
  refine?(raw: z.output<S>, ctx: z.RefinementCtx): void;
  compile(raw: z.output<S>, ctx: CompileContext): D | null;
  verify?(def: D, where: string, issues: string[]): void;
  checksStimulus?(def: D): boolean;
  textKeys?(def: D): readonly TextKeyRef[];
}

export type KindSchema = z.ZodType<ExerciseYamlBase> & z.core.$ZodTypeDiscriminable;

/** Widened to the base def shape (`SubjectContent.kinds` entries); concrete kinds widen to it. */
export type AnyExerciseKindContent = ExerciseKindContent<ExerciseDefBase, KindSchema>;
