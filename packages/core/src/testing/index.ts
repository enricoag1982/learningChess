/**
 * `@chess-kids/core/testing`: fixture builders, in-memory port fakes and shared test drivers for
 * `packages/core`, `packages/content` and `apps/web/src/adapters` tests — plus, since a kind's own
 * `solution`/`wrongAction`/`textKeys` are content-build-time-or-test-only (kind.ts), the one place
 * `packages/content`'s own (non-test) build reaches them too. Never imported from `index.ts` — this
 * subpath never reaches the app bundle (see `package.json`'s `exports`).
 */
export * from './builders.ts';
export * from './fakes.ts';
export * from './play.ts';
export {
  EXERCISE_SOLUTIONS,
  solutionOf,
  type AnyExerciseSolution,
} from '../domain/exercise/kinds/solutions.ts';
