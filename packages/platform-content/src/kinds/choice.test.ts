import { describe, expect, it } from 'vitest';
import type {
  ChoiceDefBase,
  ChoiceOptionBase,
} from '@learn/platform-core/domain/exercise/kinds/choice/def';
import { z } from 'zod';
import { createExerciseSchema } from '../lesson-schema.ts';
import { exerciseBaseFields } from '../schema.ts';
import { createChoiceContent } from './choice.ts';
import { makeCompileContext } from './kind-content.ts';

interface ValueOption extends ChoiceOptionBase {
  readonly value?: number;
}
type ValueDef = ChoiceDefBase<ValueOption> & { readonly note: string };

const fields = { ...exerciseBaseFields, note: z.string().optional() };
const optionFields = { value: z.number().int().optional() };

const content = createChoiceContent<ValueDef, typeof fields, typeof optionFields>({
  fields,
  option: {
    fields: optionFields,
    refine(raw, ctx) {
      if (raw.text === undefined && raw.value === undefined) {
        ctx.addIssue({ code: 'custom', message: 'option needs "text" or "value"' });
      }
    },
    compile: (raw) => (raw.value === undefined ? {} : { value: raw.value }),
  },
  body: (raw) => ({ note: raw.note ?? 'none' }),
  check: (def, raw, ctx) => {
    if (raw.note === 'bad') ctx.issues.push(`${ctx.where}: bad note on "${def.id}"`);
  },
});
const schema = createExerciseSchema({ choice: content });

function exercise(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'ch-01',
    type: 'choice',
    options: [
      { id: 'a', value: 3 },
      { id: 'b', text: 'four' },
    ],
    answer: 'b',
    ...overrides,
  };
}

function issuesOf(raw: unknown): readonly string[] {
  const result = schema.safeParse(raw);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

function compile(raw: Record<string, unknown>): { def: ValueDef | null; issues: string[] } {
  const issues: string[] = [];
  const ctx = makeCompileContext(
    'lesson.yaml',
    'exercises[0]',
    issues,
    {
      id: 'ch-01',
      concept: 'pick',
      textKey: 'lessons:ch-01',
    },
    undefined,
    { head: {}, tail: {} },
  );
  return { def: content.compile(schema.parse(raw), ctx), issues };
}

describe('createChoiceContent', () => {
  it('accepts a valid exercise', () => {
    expect(issuesOf(exercise())).toEqual([]);
  });

  it('rejects fewer than 2 options', () => {
    expect(issuesOf(exercise({ options: [{ id: 'b', value: 4 }] }))).toHaveLength(1);
  });

  it('reports a duplicate option id', () => {
    const options = [
      { id: 'b', value: 3 },
      { id: 'b', value: 4 },
    ];
    expect(issuesOf(exercise({ options }))).toEqual(['duplicate option id "b"']);
  });

  it('reports an answer that is not an option id', () => {
    expect(issuesOf(exercise({ answer: 'z' }))).toEqual([
      '"answer" must reference one of "options"',
    ]);
  });

  it("runs the subject's option refine and rejects unknown option fields", () => {
    const bare = [{ id: 'a' }, { id: 'b', value: 4 }];
    expect(issuesOf(exercise({ options: bare }))).toEqual(['option needs "text" or "value"']);
    expect(
      issuesOf(
        exercise({
          options: [
            { id: 'a', value: 1, extra: 1 },
            { id: 'b', value: 2 },
          ],
        }),
      ),
    ).toHaveLength(1);
  });

  it('compiles in the order type, options, answer, body, with option id, textKey, own fields', () => {
    const { def, issues } = compile(exercise());
    expect(issues).toEqual([]);
    expect(Object.keys(def ?? {})).toEqual([
      'id',
      'concept',
      'textKey',
      'type',
      'options',
      'answer',
      'note',
    ]);
    expect(def?.options.map((option) => Object.keys(option))).toEqual([
      ['id', 'value'],
      ['id', 'textKey'],
    ]);
    expect(def?.options[1]?.textKey).toBe('lessons:four');
    expect(def?.note).toBe('none');
  });

  it('hands the compiled def and raw exercise to the subject check', () => {
    expect(compile(exercise({ note: 'bad' })).issues).toEqual([
      'lesson.yaml: exercises[0]: bad note on "ch-01"',
    ]);
  });

  it('lists the text option keys', () => {
    const { def } = compile(exercise());
    expect(def && content.textKeys?.(def)).toEqual([{ key: 'lessons:four', label: 'option "b"' }]);
  });
});
