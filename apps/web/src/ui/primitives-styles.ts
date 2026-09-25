/**
 * Class-string builders behind the shared "tappable vs info" primitives (`primitives.tsx`,
 * docs/screens.md §1, roadmap F3). Split into its own (non-`.tsx`) module so a plain-function
 * export here never trips `react-refresh/only-export-components` on `primitives.tsx` — the same
 * split `lesson/button-styles.ts` and `parent/parent-styles.ts` already use, and indeed build on.
 */

/** Fill role for a raised tappable: `neutral` = `card`/`line` (secondary buttons, tiles, rows,
 * chips), or one of the three colour roles (docs/screens.md §1.1). */
export type TapRole = 'go' | 'today' | 'info' | 'neutral';

/** Shape/sizing family for a raised tappable. */
export type TapVariant = 'primary' | 'secondary' | 'tile' | 'row' | 'chip';

const VARIANT_BASE: Readonly<Record<TapVariant, string>> = {
  primary:
    'flex h-16 flex-1 items-center justify-center gap-2 rounded-2xl px-4 font-display text-lg font-semibold',
  secondary:
    'flex h-16 flex-1 items-center justify-center gap-2 rounded-2xl px-4 font-display text-lg font-semibold',
  tile: 'flex min-h-24 w-full flex-col items-center justify-center gap-2 rounded-[2rem] py-4',
  row: 'flex min-h-16 w-full items-center gap-3 rounded-2xl px-4 py-3 text-left',
  chip: 'flex h-11 items-center justify-center rounded-xl px-4 text-sm font-bold',
};

const ROLE_FILL: Readonly<Record<TapRole, string>> = {
  go: 'tap-go bg-go text-white',
  today: 'tap-today bg-today text-white',
  info: 'tap-info bg-info text-white',
  neutral: 'bg-card text-ink',
};

/** Full class string for a raised tappable of `variant`/`role`, `extra` classes appended last (so
 * they can still override sizing/colour when a caller genuinely needs to, e.g. `flex-1` removed). */
export function tapButtonClass(variant: TapVariant, role: TapRole = 'neutral', extra = ''): string {
  return `tap-raised ${VARIANT_BASE[variant]} ${ROLE_FILL[role]} ${extra}`.trim();
}

/** Flat, tinted panel class for read-only content — no border, no shadow (docs/screens.md §1
 * "Info only"). `tint` is a `bg-*` Tailwind class; radius/padding are each caller's own (a smaller
 * radius than the matching raised look, by the same rule), passed via `extra`/`className` so they
 * never fight a baked-in default at equal Tailwind specificity. */
export function infoPanelClass(tint = 'bg-cream', extra = ''): string {
  return `info-flat ${tint} ${extra}`.trim();
}

/** Flat pill class (rank / stars / streak, a counter): tinted, rounded, no border/shadow. Never a
 * single bold centred word alone in the box (docs/screens.md §1 "text never looks like a button
 * label") — every caller pairs it with an icon, a value, or both. Sizing/text weight are each
 * caller's own via `extra`/`className` (kept out of the default, so they never fight it at equal
 * Tailwind specificity). */
export function infoPillClass(tint = 'bg-cream', extra = ''): string {
  return `info-flat inline-flex items-center gap-2 rounded-2xl px-4 ${tint} ${extra}`.trim();
}
