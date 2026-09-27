/**
 * `@chess-kids/core/testing`: fixture builders, in-memory port fakes and shared test drivers for
 * `packages/core`, `packages/content` and `apps/web/src/adapters` tests. Never imported from
 * `index.ts` — this subpath never reaches the app bundle (see `package.json`'s `exports`).
 */
export * from './builders.ts';
export * from './fakes.ts';
export * from './play.ts';
