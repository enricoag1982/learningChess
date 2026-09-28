/** Class-string builders for the flat "info" side of `primitives.tsx` (docs/screens.md §1); the
 * raised-tappable side (`tapClass`) lives in `tap.ts`. */

/** Flat, tinted panel class for read-only content — no border, no shadow. `tint` is a `bg-*`
 * class; radius/padding are each caller's own, via `extra`/`className`. */
export function infoPanelClass(tint = 'bg-cream', extra = ''): string {
  return `info-flat ${tint} ${extra}`.trim();
}

/** Flat pill class (rank/stars/streak): icon + text, no border/shadow/background box by default.
 * Never a single bold word alone — every caller pairs it with an icon, a value, or both. */
export function infoPillClass(tint = '', extra = ''): string {
  return `info-flat inline-flex items-center gap-2 rounded-2xl px-4 ${tint} ${extra}`.trim();
}
