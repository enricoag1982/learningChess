import { tapClass } from '../ds/tap.ts';

/** Shared button styling for the lesson's secondary (outline) and primary (filled green) actions —
 * both raised tappables (docs/screens.md §1, roadmap F3), built from the shared `tapClass`. */
export const SECONDARY_BUTTON = tapClass('secondary', 'neutral');
export const PRIMARY_BUTTON = tapClass('primary', 'go');
