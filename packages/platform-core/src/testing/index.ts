/**
 * `@learn/platform-core/testing`: platform fixture builders and in-memory port fakes for tests.
 * Never imported from `index.ts` — this subpath never reaches the app bundle (see `package.json`'s
 * `exports`).
 */
export * from './builders.ts';
export * from './fakes.ts';
