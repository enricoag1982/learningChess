/**
 * Grown-ups-area-only tap styling (lazy chunks only, refactor-v4.md §4 "Initial JS must not
 * grow"): chip/row looks and the danger/locked fills, kept out of `ds/tap.ts` and
 * `parent/parent-styles.ts` (reached before the parent gate by `PasswordScreen`/`FirstRunScreen`,
 * so it stays eager) so these strings never land in the eager chunk (lead review 2026-09-27: was
 * +0.8 KB gz there). Self-contained (no import from `ds/tap.ts`) so nothing here can pull this
 * module's own strings into whatever chunk `tap.ts` ends up in — a plain `.ts` module too (not
 * `.tsx`), so only-export-components stays happy for `ds/parent.tsx`.
 */

// Same base/fill strings as `ds/tap.ts`'s `parent` look and `neutral`/`info`/`none` tones — kept as
// its own tiny copy rather than an import, on purpose (see above).
const PARENT_LOOK = 'flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold';
const CHIP_LOOK = 'flex h-11 items-center justify-center rounded-xl px-4 text-sm font-bold';
const ROW_LOOK =
  'flex min-h-[44px] w-full items-center gap-3 rounded-2xl bg-card px-4 py-3 text-left';
const NEUTRAL_FILL = 'bg-card text-ink';
const INFO_FILL = 'tap-info bg-info text-white';
const DANGER_FILL = 'tap-border-today bg-card text-[#8C4012]';
const LOCKED_FILL = 'bg-[#F3EDE0] text-muted';

function tap(look: string, fill: string): string {
  return `tap-raised ${look} ${fill}`.replace(/\s+/g, ' ').trim();
}

export const PARENT_DANGER_BUTTON = tap(PARENT_LOOK, DANGER_FILL);
/** A pressed/selected chip (daily limit, computer level, piece style pickers) — tappable, raised. */
export const PARENT_CHIP_SELECTED = tap(CHIP_LOOK, INFO_FILL);
/** An unselected, available chip — tappable, raised. */
export const PARENT_CHIP = tap(CHIP_LOOK, NEUTRAL_FILL);
/** A locked/unavailable chip (docs/screens.md §1: never red — grey + a lock icon carries the
 * meaning; disabled — raised shape kept, no ledge). */
export const PARENT_CHIP_LOCKED = tap(CHIP_LOOK, LOCKED_FILL);
/**
 * Tappable row (docs/screens.md §1 "Tappable vs info", roadmap F3 — decided here for the parent
 * area: a raised card with a border and a chevron, so it reads as a button/link, unlike a flat
 * info panel). Used for the Overview's child cards and the report/backup entry rows.
 */
export const PARENT_TAPPABLE_ROW = tap(ROW_LOOK, '');
