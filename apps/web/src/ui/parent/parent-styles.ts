import { tapClass } from '../ds/tap.ts';

/**
 * Shared button/input styling for parent-area screens: adult style, denser, ≥44px targets. Built
 * on the same `tapClass`/`info-flat` tokens every other screen uses (docs/screens.md §1,
 * roadmap F3) — the parent area's own M5.1 "raised row / flat panel" pair is this system's first
 * instance, not a second one; `index.css`'s `.tap-raised`/`.info-flat` and the `--color-ledge-*`
 * tokens are the single source of truth for both.
 */
// The chip / tappable-row / danger-button pieces live in `ds/parent-styles-lazy.ts` instead, not
// here: this module (and `PARENT_INFO_PANEL` below) is reached before the parent gate too, via
// `PrivacyPolicy.tsx` <- `FirstRunScreen.tsx`, so it must stay in the eager bundle — refactor-v4.md
// §4 "Initial JS must not grow" (lead review 2026-09-27).
export const PARENT_PRIMARY_BUTTON = tapClass('parent', 'go', 'disabled:opacity-50');
export const PARENT_SECONDARY_BUTTON = tapClass('parent', 'neutral');
export const PARENT_INPUT =
  'h-11 rounded-xl border-2 border-line bg-card px-4 text-base text-ink outline-none focus:border-info';
/** Orange, never red (docs/screens.md §1): validation/attempt messages in parent screens. */
export const PARENT_NOTE = 'text-sm font-bold text-[#8C4012]';
/** A flat, non-tappable info panel (docs/screens.md §1 "tappable vs info", roadmap F3) — no
 * `tapClass` involved, so no cost to keeping it here alongside the eager-reachable pieces above. */
export const PARENT_INFO_PANEL = 'info-flat rounded-xl bg-cream px-4 py-3';
