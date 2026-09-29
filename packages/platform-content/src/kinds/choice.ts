import type { TextKeyRef } from '@learn/platform-core';
import type { ChoiceDefBase } from '@learn/platform-core/domain/exercise/kinds/choice/def';
import { z } from 'zod';
import type { exerciseBaseFields } from '../schema.ts';
import { keySchema, textRefSchema } from '../schema.ts';
import type { ExerciseYamlBase, ZodShape } from '../subject.ts';
import type { CompileContext, ExerciseKindContent, KindSchema } from './kind-content.ts';

type BaseShape = typeof exerciseBaseFields;

interface OptionHead {
  readonly id: string;
  readonly text?: string;
}

/** An option as authored: `id`, `text` and the subject's own fields. */
export type ChoiceOptionRaw<OF extends ZodShape> = OptionHead & z.output<z.ZodObject<OF>>;

interface ChoiceHead<OF extends ZodShape> extends ExerciseYamlBase {
  readonly type: 'choice';
  readonly options: readonly ChoiceOptionRaw<OF>[];
  readonly answer: string;
}

interface ChoiceShape<OF extends ZodShape> {
  readonly type: z.ZodLiteral<'choice'>;
  readonly options: z.ZodArray<z.ZodType<ChoiceOptionRaw<OF>>>;
  readonly answer: z.ZodString;
}

/** A choice exercise as authored: the subject's `fields`, `type`, `options` and `answer`. */
export type ChoiceRaw<F extends ZodShape, OF extends ZodShape> = ChoiceHead<OF> &
  z.output<z.ZodObject<F>>;

export interface ChoiceContentSpec<
  D extends ChoiceDefBase,
  F extends ZodShape & BaseShape,
  OF extends ZodShape,
> {
  /** Common, stimulus and extra fields of the exercise (`id`, `text`, `easier` included). */
  readonly fields: F;
  readonly option: {
    /** Fields beside `id` and `text`. */
    readonly fields: OF;
    /** Cross-field check of one option ("needs text or …"). */
    refine(raw: ChoiceOptionRaw<OF>, ctx: z.RefinementCtx): void;
    /** The option's own compiled fields; the factory adds `id` and `textKey`. */
    compile(raw: ChoiceOptionRaw<OF>): Omit<D['options'][number], 'id' | 'textKey'>;
  };
  /** Def fields after `answer`. */
  body?(raw: ChoiceRaw<F, OF>): object;
  /** Semantic check of the compiled def. */
  check?(def: D, raw: ChoiceRaw<F, OF>, ctx: CompileContext): void;
}

/** The `choice` kind's content: the factory owns `type`, `options` (at least 2), `answer`, the duplicate-id and
 * answer-is-an-option checks, and the option `textKeys`. */
export function createChoiceContent<
  D extends ChoiceDefBase,
  F extends ZodShape & BaseShape,
  OF extends ZodShape,
>(spec: ChoiceContentSpec<D, F, OF>): ExerciseKindContent<D, KindSchema> {
  // Zod's output over a generic shape is a deferred type: this assertion is the one trust point between
  // the schema and the `ChoiceOptionRaw` the spec's callbacks are typed against.
  const option = (
    z
      .object({ id: keySchema, text: textRefSchema.optional(), ...spec.option.fields })
      .strict() as z.ZodType<ChoiceOptionRaw<OF>>
  ).superRefine((raw, ctx) => {
    spec.option.refine(raw, ctx);
  });

  return {
    type: 'choice',
    schema: z
      .object<BaseShape & ChoiceShape<OF>>({
        ...spec.fields,
        type: z.literal('choice'),
        options: z.array(option).min(2),
        answer: z.string(),
      })
      .strict(),
    refine(raw: ChoiceRaw<F, OF>, ctx) {
      const seen = new Set<string>();
      for (const { id } of raw.options) {
        if (seen.has(id)) {
          ctx.addIssue({
            code: 'custom',
            path: ['options'],
            message: `duplicate option id "${id}"`,
          });
        }
        seen.add(id);
      }
      if (!seen.has(raw.answer)) {
        ctx.addIssue({
          code: 'custom',
          path: ['answer'],
          message: '"answer" must reference one of "options"',
        });
      }
    },
    compile(raw: ChoiceRaw<F, OF>, ctx) {
      const def = ctx.build<D>({
        type: 'choice',
        options: raw.options.map((entry) => ({
          id: entry.id,
          ...(entry.text === undefined ? {} : { textKey: `lessons:${entry.text}` }),
          ...spec.option.compile(entry),
        })),
        answer: raw.answer,
        ...spec.body?.(raw),
      });
      spec.check?.(def, raw, ctx);
      return def;
    },
    textKeys: (def): readonly TextKeyRef[] =>
      def.options.flatMap((entry) =>
        entry.textKey === undefined ? [] : [{ key: entry.textKey, label: `option "${entry.id}"` }],
      ),
  };
}
