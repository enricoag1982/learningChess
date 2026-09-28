/**
 * Stubs `window.matchMedia` so only `query` reports `matches: true` (every other query is `false`),
 * for tests of `useMediaQuery` / `useIsStackedLayout` at a layout jsdom can't otherwise simulate
 * (no real viewport). Returns a restore function; callers should call it (e.g. in a `finally`).
 */
export function stubMatchMedia(query: string): () => void {
  // jsdom has no `matchMedia` at all by default (see useMediaQuery.ts): restore that exact
  // "missing" state afterwards, rather than leaving some function (real or stub) behind for
  // later tests in the same file to trip over.
  const hadOriginal = typeof window.matchMedia === 'function';
  const original = hadOriginal ? window.matchMedia.bind(window) : undefined;
  const stub: typeof window.matchMedia = (q) => ({
    matches: q === query,
    media: q,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  });
  window.matchMedia = stub;
  return () => {
    if (original) {
      window.matchMedia = original;
    } else {
      Reflect.deleteProperty(window, 'matchMedia');
    }
  };
}
