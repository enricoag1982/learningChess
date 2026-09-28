import i18next from 'i18next';
// Node's ESM loader (this file runs straight under Playwright, outside Vite) requires this
// attribute for a JSON import.
import en from '@chess-kids/content/locales/en.json' with { type: 'json' };
import { i18nOptions } from '../../src/i18n-options.ts';

/**
 * A standalone i18next instance for Playwright specs (outside the browser/React tree), built from
 * the exact options the real app initializes with (`src/i18n-options.ts`) — so `contentText`
 * resolves the same strings `tContent`/`t()` render in the app, without a hand-rolled namespace
 * lookup.
 */
const e2eI18n = i18next.createInstance();
// Resources are bundled at build time (same comment as `src/i18n.ts`): init completes
// synchronously, so every export below can use `e2eI18n` right away.
void e2eI18n.init(i18nOptions({ en }));

/**
 * Resolves a content text key (e.g. `lessons:rook.title`, `characters:rhino.name`, or a
 * namespace-less `piece.r`, resolved against the `common` default namespace) against the real
 * compiled English strings — the same text the app renders via `tContent`/`t()`. A key whose
 * template still has unfilled `{{placeholders}}` is returned as-is (pass it to `interpolate`).
 */
export function contentText(key: string): string {
  // Same relaxation as the app's own `tContent` (`content-text.ts`): a dynamic key (read from
  // built content/tracks, not authored in this file as a literal) can't be checked against the
  // literal key union `t()` otherwise enforces.
  const dynamic = e2eI18n.t as unknown as (
    k: string,
    opts?: Readonly<Record<string, unknown>>,
  ) => string;
  return dynamic(key, { interpolation: { skipOnVariables: true } });
}

/** Replaces every `{{key}}` in a compiled text template with `String(vars[key])`, via the same
 * i18next instance `contentText` uses (no plural handling — none of these templates need it). */
export function interpolate(
  template: string,
  vars: Readonly<Record<string, string | number>>,
): string {
  return e2eI18n.services.interpolator.interpolate(template, vars, e2eI18n.language, {});
}
