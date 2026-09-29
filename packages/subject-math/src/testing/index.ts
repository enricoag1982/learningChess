/**
 * `@learn/subject-math/testing`: the exercise-solving drivers. Never imported from the package barrel, so none of it
 * reaches the app bundle.
 */
export { playSolution, playWrongThenSolve, starsFor } from './play.ts';
export { MATH_SOLUTIONS, solutionOf, type AnyMathSolution } from '../kinds/solutions.ts';
