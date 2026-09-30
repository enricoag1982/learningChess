/** Class-string builder behind every raised tappable (docs/screens.md §1). `look` is the
 * shape/sizing family, `tone` the fill; `extra` appends any classes a caller still needs. */

/** Fill: `neutral` = card/ink (default), a colour role, or `none` for a caller's own `extra`.
 * `danger`/`locked` live in `ds/parent-styles-lazy.ts` (kept out of the initial bundle). */
export type TapTone = 'neutral' | 'go' | 'today' | 'info' | 'none';

/** Shape/sizing family. `custom` contributes no base classes: `extra` carries the whole shape.
 * `parent-chip`/`parent-row` live in `ds/parent-styles-lazy.ts`, same reason as `TapTone`. */
export type TapLook =
  | 'round'
  | 'round-md'
  | 'round-sm'
  | 'dialog'
  | 'block'
  | 'hero'
  | 'cta'
  | 'wide'
  | 'next'
  | 'primary'
  | 'compact'
  | 'parent'
  | 'custom';

const LOOK_BASE: Readonly<Record<TapLook, string>> = {
  // Round icon-only button: kid 64px (Back headers), game 56px (Close header, replay) and parent 44px (ChevronLeft headers).
  round: 'flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full',
  'round-md': 'flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full',
  'round-sm': 'flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full',
  // Confirm-dialog Yes/No pair (kid alertdialogs, FriendGame/FullGame).
  dialog:
    'flex h-14 flex-1 items-center justify-center rounded-2xl font-display text-lg font-semibold',
  // Full-width kid block CTA (Placement offer / Time limit yes-no).
  block: 'h-20 rounded-[2rem] font-display text-xl font-semibold sm:text-2xl',
  // Big kid primary CTA (New player / First run).
  hero: 'flex h-16 w-full max-w-sm items-center justify-center rounded-[2rem] px-8 font-display text-xl font-semibold sm:h-20 sm:text-2xl',
  // Lesson Complete's Play again / Continue pair.
  cta: 'h-20 flex-1 rounded-3xl font-display text-xl font-semibold',
  // Mid-width in-flow option (vs Friend's per-player strip).
  wide: 'flex h-14 items-center justify-center rounded-2xl px-4 font-display text-base font-semibold',
  // Lesson's one forward action (NextButton, and vs Friend's own final CTA).
  next: 'flex h-16 items-center justify-center gap-3 rounded-3xl px-6 font-display text-xl font-semibold',
  primary:
    'flex h-16 flex-1 items-center justify-center gap-2 rounded-2xl px-4 font-display text-lg font-semibold',
  // Game-screen action (Hint / Undo / Check / Skip / answers): 56px, icon + short label, shares one row.
  compact:
    'flex h-14 min-w-14 flex-1 items-center justify-center gap-2 rounded-2xl px-3 font-display text-base font-semibold',
  parent: 'flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold',
  custom: '',
};

const TONE_FILL: Readonly<Record<TapTone, string>> = {
  neutral: 'bg-card text-ink',
  go: 'tap-go bg-go text-white',
  today: 'tap-today bg-today text-white',
  info: 'tap-info bg-info text-white',
  none: '',
};

/** `tap-raised` + `look`'s shape + `tone`'s fill + `extra` last (a conditional fill there overrides `tone: 'none'`). */
export function tapClass(look: TapLook, tone: TapTone = 'neutral', extra = ''): string {
  return `tap-raised ${LOOK_BASE[look]} ${TONE_FILL[tone]} ${extra}`.replace(/\s+/g, ' ').trim();
}
