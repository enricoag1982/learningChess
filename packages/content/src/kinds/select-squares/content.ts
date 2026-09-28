import {
  chessJsRules,
  isInCheck,
  selectSquaresAnswer,
  type SelectSquaresDef,
  type Square,
} from '@chess-kids/core/chess';
import { z } from 'zod';
import { exerciseCommonFields, rules, squareSchema } from '../common.ts';
import type { ExerciseKindContent } from '../kind-content.ts';
import type { CompileContext } from '../kind-content.ts';

/** Tap the correct set of squares: explicit `answer`, or `derive`d from the position. */
export const schema = z
  .object({
    ...exerciseCommonFields,
    type: z.literal('select-squares'),
    answer: z.array(squareSchema).optional(),
    derive: z.enum(['legal-moves', 'attacked-by', 'check-escapes']).optional(),
    from: squareSchema.optional(),
  })
  .strict();

/** Exactly one of `answer` or `derive` (+ `from`, when the derivation needs a source square). */
function refine(value: z.output<typeof schema>, ctx: z.RefinementCtx): void {
  const hasAnswer = value.answer !== undefined;
  const hasDerive = value.derive !== undefined || value.from !== undefined;
  if (hasAnswer === hasDerive) {
    ctx.addIssue({
      code: 'custom',
      message: 'exactly one of "answer" or "derive" + "from" is required',
    });
    return;
  }
  if (hasAnswer && value.answer?.length === 0) {
    ctx.addIssue({ code: 'custom', path: ['answer'], message: '"answer" must not be empty' });
  }
  if (hasDerive) {
    const needsFrom = value.derive === 'legal-moves' || value.derive === 'attacked-by';
    if (value.derive === undefined) {
      ctx.addIssue({ code: 'custom', path: ['derive'], message: '"from" requires "derive"' });
    } else if (needsFrom && value.from === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['from'],
        message: `"derive: ${value.derive}" requires "from"`,
      });
    } else if (!needsFrom && value.from !== undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['from'],
        message: `"derive: ${value.derive}" must not set "from"`,
      });
    }
  }
}

/** Value guaranteed non-`undefined` by a zod schema that already validated successfully. */
function assertValidated<T>(value: T | undefined, context: string): T {
  if (value === undefined) {
    throw new Error(`lesson-load: ${context}: expected a value already validated by the schema`);
  }
  return value;
}

function compile(raw: z.output<typeof schema>, ctx: CompileContext): SelectSquaresDef {
  let answer: SelectSquaresDef['answer'];
  if (raw.answer !== undefined) {
    answer = { squares: raw.answer as readonly Square[] };
  } else if (raw.derive === 'check-escapes') {
    answer = { derive: 'check-escapes' };
  } else if (raw.derive === 'attacked-by') {
    answer = {
      derive: 'attacked-by',
      from: assertValidated(raw.from, `${ctx.where}.from`) as Square,
    };
  } else {
    answer = {
      derive: 'legal-moves',
      from: assertValidated(raw.from, `${ctx.where}.from`) as Square,
    };
  }
  return ctx.build({ type: 'select-squares', answer });
}

/** `derive: check-escapes`: the side to move's king must actually be in check, and have at least
 * one legal escape square. */
function checkCheckEscapesShape(exercise: SelectSquaresDef, where: string, issues: string[]): void {
  if (!isInCheck(exercise.position, chessJsRules)) {
    issues.push(`${where}: check-escapes requires the side to move's king to be in check`);
    return;
  }
  if (selectSquaresAnswer(exercise, rules).length === 0) {
    issues.push(`${where}: check-escapes has no legal king move`);
  }
}

function verify(exercise: SelectSquaresDef, where: string, issues: string[]): void {
  if ('squares' in exercise.answer) {
    if (exercise.answer.squares.length === 0) {
      issues.push(`${where}: select-squares answer is empty`);
    }
    return;
  }
  if (exercise.answer.derive === 'check-escapes') {
    checkCheckEscapesShape(exercise, where, issues);
    return;
  }
  const fromPiece = exercise.position.pieces[exercise.answer.from];
  if (exercise.answer.derive === 'legal-moves') {
    if (fromPiece === undefined || fromPiece.color !== exercise.position.toMove) {
      issues.push(`${where}: select-squares "from" square has no piece of the side to move`);
    }
    return;
  }
  // attacked-by
  if (fromPiece === undefined) {
    issues.push(`${where}: select-squares "from" square has no piece`);
  }
}

export const selectSquares: ExerciseKindContent<SelectSquaresDef, typeof schema> = {
  type: 'select-squares',
  schema,
  refine,
  compile,
  verify,
  /** Explicit `squares` answer: a board-geometry question where a piece would only distract.
   * `derive`d answers still need a kid piece. */
  needsKidPiece(def: SelectSquaresDef): boolean {
    return !('squares' in def.answer);
  },
};
