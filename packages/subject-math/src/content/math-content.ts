// Math's `stimulus` / `demo` / kind / mode content: the concrete values the platform's compile pipeline plugs in for
// this app.
import { createChoiceContent } from '@learn/platform-content/kinds/choice';
import type { ExerciseKindContent } from '@learn/platform-content/kinds/kind-content';
import { createExerciseSchema } from '@learn/platform-content/lesson-schema';
import { createSeriesContent } from '@learn/platform-content/modes/series';
import { exerciseBaseFields, textRefSchema } from '@learn/platform-content/schema';
import type {
  BadgesContent,
  DemoContent,
  StimulusContent,
  SubjectContent,
  Where,
} from '@learn/platform-content/subject';
import { z } from 'zod';
import { MATH_CHARACTERS } from '../core/math-core.ts';
import { evaluate, parseProblem } from '../core/problem.ts';
import type { MathChoiceDef, NumberEntryDef, Problem } from '../core/types.ts';
import type { DefOf, ExerciseType } from '../kinds/index.ts';

/** A sum / difference never goes past this, so a numeral is at most 2 digits and a dot group stays countable. */
const MAX_RESULT = 20;

const MAX_ANSWER = 99;

const problemSchema = z.string().refine((text) => parseProblem(text) !== null, {
  message: 'expected "<n> + <n>" or "<n> - <n>", each n 0-99',
});

const answerSchema = z.number().int().min(0).max(MAX_ANSWER);

const withProblemSchema = z.object({
  problem: z.object({ a: z.number(), op: z.enum(['+', '-']), b: z.number() }).optional(),
});

/** A compiled def's or demo's problem must not go below zero or above `MAX_RESULT`. */
function checkProblem(compiled: object, at: Where): void {
  const parsed = withProblemSchema.safeParse(compiled);
  const problem: Problem | undefined = parsed.success ? parsed.data.problem : undefined;
  if (problem === undefined) return;
  const text = `${String(problem.a)} ${problem.op} ${String(problem.b)}`;
  if (problem.op === '-' && problem.a < problem.b) {
    at.issues.push(`${at.where}: "${text}" goes below zero`);
  } else if (evaluate(problem) > MAX_RESULT) {
    at.issues.push(`${at.where}: "${text}" is above ${String(MAX_RESULT)}`);
  }
}

/** The stimulus: an optional `problem` (`'3 + 2'`), compiled into the def's head. */
export const mathStimulus: StimulusContent = {
  compile(raw, at) {
    if (!('problem' in raw) || typeof raw.problem !== 'string') {
      return { head: {}, tail: {} };
    }
    const problem = parseProblem(raw.problem);
    if (problem === null) {
      at.issues.push(`${at.where}.problem: not a sum or a difference`);
      return null;
    }
    return { head: { problem }, tail: {} };
  },

  check: checkProblem,
};

const mathExerciseFields = { ...exerciseBaseFields, problem: problemSchema.optional() };

const optionFields = { value: z.number().int().min(0).max(MAX_ANSWER).optional() };

/** Pick the option whose `value` is the problem's result; without a problem there is nothing to check. */
export const choice = createChoiceContent<
  MathChoiceDef,
  typeof mathExerciseFields,
  typeof optionFields
>({
  fields: mathExerciseFields,
  option: {
    fields: optionFields,
    refine(raw, ctx) {
      if (raw.text === undefined && raw.value === undefined) {
        ctx.addIssue({ code: 'custom', message: 'option needs "text" or "value"' });
      }
    },
    compile: (raw) => (raw.value === undefined ? {} : { value: raw.value }),
  },
  check(def, _raw, ctx) {
    if (def.problem === undefined) return;
    const result = evaluate(def.problem);
    const matching = def.options.filter((option) => option.value === result);
    if (matching.length !== 1 || matching[0]?.id !== def.answer) {
      ctx.issues.push(
        `${ctx.where}: exactly one option must equal ${String(result)}, and it must be the answer "${def.answer}"`,
      );
    }
  },
});

const numberEntrySchema = z
  .object({
    ...mathExerciseFields,
    problem: problemSchema,
    type: z.literal('number-entry'),
    answer: answerSchema,
  })
  .strict();

export const numberEntry: ExerciseKindContent<NumberEntryDef, typeof numberEntrySchema> = {
  type: 'number-entry',
  schema: numberEntrySchema,
  compile: (raw, ctx) => ctx.build<NumberEntryDef>({ type: 'number-entry', answer: raw.answer }),
  verify(def, where, issues) {
    const result = def.problem === undefined ? undefined : evaluate(def.problem);
    if (result !== undefined && result !== def.answer) {
      issues.push(`${where}: answer ${String(def.answer)} but the problem is ${String(result)}`);
    }
  },
};

export const MATH_KIND_CONTENT = {
  choice,
  'number-entry': numberEntry,
} as const satisfies {
  readonly [T in ExerciseType]: ExerciseKindContent<DefOf<T>, z.ZodType>;
};

export const mathExerciseSchema = createExerciseSchema(MATH_KIND_CONTENT, mathStimulus);

/** A lesson demo: an optional spoken-text key (default `<lesson-id>.demo`) and the problem shown with dots. */
const mathDemoSchema = z
  .object({ text: textRefSchema.optional(), problem: problemSchema })
  .strict();

export const mathDemo: DemoContent = {
  schema: mathDemoSchema,

  compile(raw, textKey, at) {
    const parsed = mathDemoSchema.safeParse(raw);
    const problem = parsed.success ? parseProblem(parsed.data.problem) : null;
    if (problem === null) {
      at.issues.push(`${at.where}.problem: not a sum or a difference`);
      return null;
    }
    return { textKey, problem };
  },

  check: checkProblem,
};

/** No badge condition beyond the engine's generic ones. */
export const mathBadges: BadgesContent = { fields: {}, validate: () => undefined };

/** Math's whole `SubjectContent`; `series` is its only mini-game mode, so no mode is a default. */
export const mathContent: SubjectContent = {
  kinds: MATH_KIND_CONTENT,
  modes: { series: createSeriesContent(mathExerciseSchema) },
  stimulus: mathStimulus,
  demo: mathDemo,
  badges: mathBadges,
  characters: MATH_CHARACTERS,
  voiceTemplates: () => undefined,
};
