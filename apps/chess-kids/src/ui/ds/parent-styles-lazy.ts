/** Grown-ups-area-only tap styling, kept out of `ds/tap.ts` so these strings stay out of the
 * eager chunk; a self-contained copy of its base/fill strings, on purpose. */
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
/** A locked/unavailable chip (docs/screens.md §1: never red — grey + a lock icon). */
export const PARENT_CHIP_LOCKED = tap(CHIP_LOOK, LOCKED_FILL);
/** Tappable row (docs/screens.md §1): a raised card with a border, unlike a flat info panel. */
export const PARENT_TAPPABLE_ROW = tap(ROW_LOOK, '');
