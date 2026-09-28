import { tapClass } from '../ds/tap.ts';

/** Shared button/input styling for parent-area screens (docs/screens.md §1). Chip/row/danger
 * pieces live in `ds/parent-styles-lazy.ts` instead: this module stays in the eager bundle. */
export const PARENT_PRIMARY_BUTTON = tapClass('parent', 'go', 'disabled:opacity-50');
export const PARENT_SECONDARY_BUTTON = tapClass('parent', 'neutral');
export const PARENT_INPUT =
  'h-11 rounded-xl border-2 border-line bg-card px-4 text-base text-ink outline-none focus:border-info';
/** Orange, never red (docs/screens.md §1): validation/attempt messages in parent screens. */
export const PARENT_NOTE = 'text-sm font-bold text-[#8C4012]';
export const PARENT_INFO_PANEL = 'info-flat rounded-xl bg-cream px-4 py-3';
