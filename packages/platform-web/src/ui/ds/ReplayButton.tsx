import type { JSX } from 'react';
import { ReplayIcon } from './icons.tsx';
import { tapClass } from './tap.ts';

export interface ReplayButtonProps {
  readonly onClick: () => void;
  readonly label: string;
  readonly className?: string;
}

/** Replays the spoken text; separate from `SpeechBubble` so a screen can place it where its layout needs (docs/screens.md). */
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
