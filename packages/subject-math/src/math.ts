// `@learn/subject-math`: math's core (types, kinds, notes, `SubjectCore`) and app identifiers. Content and
// testing live behind `/content` and `/testing`.
export type * from './core/types.ts';
export type { MathFeedback } from './core/notes.ts';
export { MATH_APP_CONFIG, MATH_CHARACTERS, mathCore } from './core/math-core.ts';
export { evaluate, parseProblem } from './core/problem.ts';
export type { AnyMathKind, MathAction, MathOutcome } from './kinds/index.ts';
export { MATH_KINDS, kindOf, startExercise } from './kinds/index.ts';
export type { Digit, NumberEntryAction, NumberEntryOutcome } from './kinds/number-entry/kind.ts';
export { DIGITS, MAX_DIGITS } from './kinds/number-entry/kind.ts';
