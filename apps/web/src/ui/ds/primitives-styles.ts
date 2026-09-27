/**
 * Class-string builders behind the shared "tappable vs info" primitives (`primitives.tsx`,
 * docs/screens.md §1, roadmap F3). The raised-tappable side (`tapClass`, `TapLook`, `TapTone`) lives
 * in `tap.ts`; this module keeps the flat "info" side. Split into its own (non-`.tsx`) module so a
 * plain-function export here never trips `react-refresh/only-export-components` on `primitives.tsx`.
 */

/** Flat, tinted panel class for read-only content — no border, no shadow (docs/screens.md §1
 * "Info only"). `tint` is a `bg-*` Tailwind class; radius/padding are each caller's own (a smaller
 * radius than the matching raised look, by the same rule), passed via `extra`/`className` so they
 * never fight a baked-in default at equal Tailwind specificity. */
export function infoPanelClass(tint = 'bg-cream', extra = ''): string {
  return `info-flat ${tint} ${extra}`.trim();
}

/** Flat pill "class" (rank / stars / streak, a counter): icon + text, no border/shadow — and, since
 * v1.1.0 part B (docs/screens.md §1 "Info = no box"), no background box either: `tint` defaults to
 * none, so a caller only ever adds one back deliberately (none currently do). Never a single bold
 * centred word alone (docs/screens.md §1 "text never looks like a button label") — every caller
 * pairs it with an icon, a value, or both. Sizing/text weight are each caller's own via
 * `extra`/`className` (kept out of the default, so they never fight it at equal Tailwind
 * specificity). */
export function infoPillClass(tint = '', extra = ''): string {
  return `info-flat inline-flex items-center gap-2 rounded-2xl px-4 ${tint} ${extra}`.trim();
}
