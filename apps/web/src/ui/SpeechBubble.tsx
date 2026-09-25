import type { JSX } from 'react';
import { Owl } from './Owl.tsx';

/** Visual tone for a note under the instruction: orange for hints/errors, green for praise. Flat
 * (info, docs/screens.md §1): a left accent bar carries the tone instead of a full box border, so
 * it never reads as a tappable card. */
const NOTE_STYLES: Record<'attention' | 'praise', string> = {
  attention: 'border-l-4 border-today bg-[#FCEEE3] text-[#7A3A0F]',
  praise: 'border-l-4 border-go bg-[#E3F1EA] text-go',
};

export interface SpeechBubbleNote {
  readonly text: string;
  readonly tone: 'attention' | 'praise';
}

export interface SpeechBubbleProps {
  /** Spoken and shown (subtitles are always on: the text itself is the subtitle). */
  readonly text: string;
  /** A hint / error / praise line under the instruction; never replaces it (teaching-process.md §3.3). */
  readonly note?: SpeechBubbleNote;
  readonly avatarClassName?: string;
  readonly bubbleClassName?: string;
}

/**
 * Owl avatar + speech bubble. `text` (the instruction, or a screen's one line) is always shown;
 * `note`, when given, appears as a second, visually distinct line under it. Speaking `text` (and
 * replaying it) is the caller's job via `useNarratedText` and `ReplayButton`, so each screen can
 * place its replay control wherever its responsive layout needs.
 */
export function SpeechBubble({
  text,
  note,
  avatarClassName,
  bubbleClassName,
}: SpeechBubbleProps): JSX.Element {
  return (
    <div className="flex items-start gap-3">
      <Owl className={avatarClassName} />
      <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
        <div className="relative w-full">
          {/* The bubble's tail, pointing at the Owl (docs/screens.md §1 "Owl bubble ... keeps its
              tail"): a small rotated square, same fill, tucked behind the bubble's left edge. */}
          <span
            aria-hidden="true"
            className="absolute top-4 -left-1.5 h-3 w-3 rotate-45 bg-[#F1EADA]"
          />
          <p
            className={`info-flat relative w-full rounded-3xl bg-[#F1EADA] px-5 py-4 font-display leading-snug text-ink ${bubbleClassName ?? 'text-xl sm:text-2xl'}`}
          >
            {text}
          </p>
        </div>
        {note && (
          <p
            className={`w-full rounded-2xl px-4 py-3 font-display text-base font-semibold leading-snug sm:text-lg ${NOTE_STYLES[note.tone]}`}
          >
            {note.text}
          </p>
        )}
      </div>
    </div>
  );
}
