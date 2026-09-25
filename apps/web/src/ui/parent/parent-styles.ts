/**
 * Shared button/input styling for parent-area screens: adult style, denser, ≥44px targets. Built
 * on the same `tap-raised`/`info-flat` tokens every other screen uses (docs/screens.md §1,
 * roadmap F3) — the parent area's own M5.1 "raised row / flat panel" pair is this system's first
 * instance, not a second one; `index.css`'s `.tap-raised`/`.info-flat` and the `--color-ledge-*`
 * tokens are the single source of truth for both.
 */
export const PARENT_PRIMARY_BUTTON =
  'tap-raised tap-go flex h-11 items-center justify-center gap-2 rounded-xl bg-go px-5 text-sm font-bold text-white disabled:opacity-50';
export const PARENT_SECONDARY_BUTTON =
  'tap-raised flex h-11 items-center justify-center gap-2 rounded-xl bg-card px-5 text-sm font-bold text-ink';
export const PARENT_DANGER_BUTTON =
  'tap-raised tap-border-today flex h-11 items-center justify-center gap-2 rounded-xl bg-card px-5 text-sm font-bold text-[#8C4012]';
export const PARENT_INPUT =
  'h-11 rounded-xl border-2 border-line bg-card px-4 text-base text-ink outline-none focus:border-info';
/** Orange, never red (docs/screens.md §1): validation/attempt messages in parent screens. */
export const PARENT_NOTE = 'text-sm font-bold text-[#8C4012]';
/** A pressed/selected chip (daily limit, computer level, piece style pickers) — tappable, raised. */
export const PARENT_CHIP_SELECTED =
  'tap-raised tap-info flex h-11 items-center justify-center rounded-xl bg-info px-4 text-sm font-bold text-white';
/** An unselected, available chip — tappable, raised. */
export const PARENT_CHIP =
  'tap-raised flex h-11 items-center justify-center rounded-xl bg-card px-4 text-sm font-bold text-ink';
/** A locked/unavailable chip (docs/screens.md §1: never red — grey + a lock icon carries the
 * meaning; disabled — raised shape kept, no ledge). */
export const PARENT_CHIP_LOCKED =
  'tap-raised flex h-11 items-center justify-center rounded-xl bg-[#F3EDE0] px-4 text-sm font-bold text-muted';
/**
 * Tappable row (docs/screens.md §1 "Tappable vs info", roadmap F3 — decided here for the parent
 * area: a raised card with a border and a chevron, so it reads as a button/link, unlike a flat
 * info panel). Used for the Overview's child cards and the report/backup entry rows.
 */
export const PARENT_TAPPABLE_ROW =
  'tap-raised flex min-h-[44px] w-full items-center gap-3 rounded-2xl bg-card px-4 py-3 text-left';
/** A flat, non-tappable info panel — the other half of the F3 tappable/info contrast. */
export const PARENT_INFO_PANEL = 'info-flat rounded-xl bg-cream px-4 py-3';
