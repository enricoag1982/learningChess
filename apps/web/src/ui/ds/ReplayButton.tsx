import type { JSX } from 'react';
import { ReplayIcon } from './icons.tsx';
import { tapClass } from './tap.ts';

export interface ReplayButtonProps {
  readonly onClick: () => void;
  /** e.g. "Listen again" (Story) or "Say it again" (Exercise / Demo / Boss / Home). */
  readonly label: string;
  readonly className?: string;
}

/** Replays the current spoken text. Kept separate from `SpeechBubble` so a screen can place it
 * wherever its responsive layout needs (docs/screens.md: every text is spoken, with a replay button). */
export function ReplayButton({ onClick, label, className = '' }: ReplayButtonProps): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${tapClass('custom', 'neutral', 'flex h-16 min-w-16 shrink-0 items-center justify-center gap-2 rounded-2xl px-4 font-semibold')} ${className}`}
    >
      <ReplayIcon />
      {label}
    </button>
  );
}
