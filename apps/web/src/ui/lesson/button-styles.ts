import { tapButtonClass } from '../primitives-styles.ts';

/** Shared button styling for the lesson's secondary (outline) and primary (filled green) actions —
 * both raised tappables (docs/screens.md §1, roadmap F3), built from the shared `tapButtonClass`. */
export const SECONDARY_BUTTON = tapButtonClass('secondary', 'neutral');
export const PRIMARY_BUTTON = tapButtonClass('primary', 'go');
