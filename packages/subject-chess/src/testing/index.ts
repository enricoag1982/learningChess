/**
 * `@learn/subject-chess/testing`: chess fixture builders, chess-defaulted `AppDeps` wiring and the
 * exercise-solving drivers. Never imported from the package barrel, so none of it reaches the app
 * bundle.
 */
export * from './builders.ts';
export * from './deps.ts';
export * from './play.ts';
export { EXERCISE_SOLUTIONS, solutionOf, type AnyExerciseSolution } from '../kinds/solutions.ts';
