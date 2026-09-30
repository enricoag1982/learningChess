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

const LABELLED =
  'flex h-16 min-w-16 shrink-0 items-center justify-center gap-2 rounded-2xl px-4 font-semibold';

/** Replays the spoken text; separate from `SpeechBubble` so a screen can place it where its layout needs (docs/screens.md). */
export function ReplayButton({
  onClick,
  label,
  className = '',
  compact = false,
}: ReplayButtonProps): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={compact ? label : undefined}
      className={`${compact ? tapClass('round-md') : tapClass('custom', 'neutral', LABELLED)} ${className}`}
    >
      <ReplayIcon />
      {!compact && label}
    </button>
  );
}
