import type { JSX } from 'react';
import type { Narrator } from '@chess-kids/core';
import { Owl } from './Owl.tsx';
import { useNarratedText } from './useNarratedText.ts';

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

export interface SpeechBubbleProps {
  readonly narrator: Narrator;
  /** Spoken and shown (subtitles are always on: the text itself is the subtitle). */
  readonly text: string;
  /** Label for the replay button, e.g. "Listen again" or "Say it again". */
  readonly replayLabel: string;
  readonly avatarClassName?: string;
  readonly bubbleClassName?: string;
}

/**
 * Owl avatar + speech bubble, spoken automatically when `text` changes and again on replay.
 * The single place every screen goes through so "every text is spoken, with a replay button and
 * visible subtitles" (non-functional.md §2) holds everywhere without repeating the wiring.
 */
export function SpeechBubble({
  narrator,
  text,
  replayLabel,
  avatarClassName,
  bubbleClassName,
}: SpeechBubbleProps): JSX.Element {
  const replay = useNarratedText(narrator, text);

  return (
    <div className="flex items-start gap-3">
      <Owl className={avatarClassName} />
      <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
        <p
          className={`w-full rounded-3xl border-2 border-line bg-card px-5 py-4 font-display leading-snug text-ink ${bubbleClassName ?? 'text-xl sm:text-2xl'}`}
        >
          {text}
        </p>
        <button
          type="button"
          onClick={replay}
          className="flex h-16 min-w-16 items-center gap-2 rounded-2xl border-2 border-line bg-card px-4 font-semibold text-ink"
        >
          <ReplayIcon />
          {replayLabel}
        </button>
      </div>
    </div>
  );
}
