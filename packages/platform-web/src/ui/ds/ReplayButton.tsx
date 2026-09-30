import type { JSX } from 'react';
import { ReplayIcon } from './icons.tsx';
import { tapClass } from './tap.ts';

export interface ReplayButtonProps {
  readonly onClick: () => void;
  readonly label: string;
  readonly className?: string;
  /** Game screens: a 56px round speaker icon; `label` stays its accessible name. */
  readonly compact?: boolean;
}

/** Replays the spoken text; separate from `SpeechBubble` so a screen can place it where its layout needs (docs/screens.md). */
export function ReplayButton({
  onClick,
  label,
  className = '',
  compact = false,
}: ReplayButtonProps): JSX.Element {
  if (compact) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className={tapClass('round-md', 'neutral', className)}
      >
        <ReplayIcon />
      </button>
    );
  }
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
