/** Class-string builders for the flat "info" side of `primitives.tsx` (docs/screens.md §1); the
 * raised-tappable side (`tapClass`) lives in `tap.ts`. */

/** Flat, tinted panel class for read-only content: no border, no shadow; `tint` is a `bg-*` class, radius / padding come from `extra` / `className`. */
export function infoPanelClass(tint = 'bg-cream', extra = ''): string {
  return `info-flat ${tint} ${extra}`.trim();
}

/** Flat pill class (rank / stars / streak): icon + text, no border, shadow or background box by default; callers pair it with an icon or value. */
export function infoPillClass(tint = '', extra = ''): string {
  return `info-flat inline-flex items-center gap-2 rounded-2xl px-4 ${tint} ${extra}`.trim();
}
