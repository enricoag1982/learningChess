import type { JSX } from 'react';

function ReplayIcon(): JSX.Element {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 9v6h4l5 4V5L8 9H4z" />
      <path d="M16 8.5a5 5 0 0 1 0 7" />
    </svg>
  );
}

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
      className={`flex h-16 min-w-16 items-center justify-center gap-2 rounded-2xl border-2 border-line bg-card px-4 font-semibold text-ink ${className}`}
    >
      <ReplayIcon />
      {label}
    </button>
  );
}
