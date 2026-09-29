/**
 * `@learn/platform-core/testing`: platform fixture builders, in-memory port fakes and the non-chess
 * `testSubject` for tests. Never imported from `index.ts` — this subpath never reaches the app
 * bundle (see `package.json`'s `exports`).
 */
export * from './builders.ts';
export * from './deps.ts';
export * from './fakes.ts';
export * from './test-subject.ts';
