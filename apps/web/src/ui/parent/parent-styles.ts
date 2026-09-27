import { tapClass } from '../ds/tap.ts';

/**
 * Shared button/input styling for parent-area screens: adult style, denser, ≥44px targets. Built
 * on the same `tapClass`/`info-flat` tokens every other screen uses (docs/screens.md §1,
 * roadmap F3) — the parent area's own M5.1 "raised row / flat panel" pair is this system's first
 * instance, not a second one; `index.css`'s `.tap-raised`/`.info-flat` and the `--color-ledge-*`
 * tokens are the single source of truth for both.
 */
export const PARENT_PRIMARY_BUTTON = tapClass('parent', 'go', 'disabled:opacity-50');
export const PARENT_SECONDARY_BUTTON = tapClass('parent', 'neutral');
export const PARENT_DANGER_BUTTON = tapClass('parent', 'danger');
export const PARENT_INPUT =
  'h-11 rounded-xl border-2 border-line bg-card px-4 text-base text-ink outline-none focus:border-info';
/** Orange, never red (docs/screens.md §1): validation/attempt messages in parent screens. */
export const PARENT_NOTE = 'text-sm font-bold text-[#8C4012]';
/** A pressed/selected chip (daily limit, computer level, piece style pickers) — tappable, raised. */
export const PARENT_CHIP_SELECTED = tapClass('parent-chip', 'info');
/** An unselected, available chip — tappable, raised. */
export const PARENT_CHIP = tapClass('parent-chip', 'neutral');
/** A locked/unavailable chip (docs/screens.md §1: never red — grey + a lock icon carries the
 * meaning; disabled — raised shape kept, no ledge). */
export const PARENT_CHIP_LOCKED = tapClass('parent-chip', 'locked');
/**
 * Tappable row (docs/screens.md §1 "Tappable vs info", roadmap F3 — decided here for the parent
 * area: a raised card with a border and a chevron, so it reads as a button/link, unlike a flat
 * info panel). Used for the Overview's child cards and the report/backup entry rows.
 */
export const PARENT_TAPPABLE_ROW = tapClass('parent-row', 'none');
/** A flat, non-tappable info panel — the other half of the F3 tappable/info contrast. */
export const PARENT_INFO_PANEL = 'info-flat rounded-xl bg-cream px-4 py-3';
