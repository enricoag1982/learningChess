// `helpers.ts` re-exports these kits so every existing `from './helpers.ts'` import keeps working
// unchanged: `kit/i18n.ts` (contentText, interpolate, over a standalone i18next instance),
// `kit/content.ts` (typed bundled content/catalog, content-derived Journey text, and the
// content/tracks lookups every spec used to copy locally: findWorld, firstJourneyLesson,
// firstTwoLessons), `kit/storage.ts` (withAppStorage + the 13 seed/read helpers, over the real
// repositories instead of hand-written localStorage JSON), `kit/pages.ts` (first-run/page-flow
// helpers, incl. `openParentArea`) and `kit/exercises.ts` (the solve/answer/boss runner, driven by
// core solutions and each exercise kind's/mini-game mode's own e2e driver — R3b PR 2).
export * from './kit/i18n.ts';
export * from './kit/content.ts';
export * from './kit/storage.ts';
export * from './kit/pages.ts';
export * from './kit/exercises.ts';
export { clickSquare } from '../src/kinds/e2e-actions.ts';
export {
  playOneKidVersusMove,
  playVersusBoss,
  waitForVersusTurnOrEnd,
} from '../src/modes/versus/e2e.ts';
