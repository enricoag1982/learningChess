import type { Problem } from './types.ts';

const PROBLEM_PATTERN = /^(\d{1,2}) ([+-]) (\d{1,2})$/;

/** `'3 + 2'` → `{ a: 3, op: '+', b: 2 }`; `null` when the text is not one number, `+` or `-`, one number. */
export function parseProblem(text: string): Problem | null {
  const [, a, op, b] = PROBLEM_PATTERN.exec(text) ?? [];
  if (a === undefined || b === undefined || (op !== '+' && op !== '-')) {
    return null;
  }
  return { a: Number(a), op, b: Number(b) };
}

export function evaluate(problem: Problem): number {
  return problem.op === '+' ? problem.a + problem.b : problem.a - problem.b;
}
