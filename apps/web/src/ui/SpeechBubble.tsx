import type { JSX } from 'react';
import { Owl } from './Owl.tsx';

/** Visual tone for a note under the instruction: orange for hints/errors, green for praise. */
const NOTE_STYLES: Record<'attention' | 'praise', string> = {
  attention: 'border-today bg-[#FCEEE3] text-[#7A3A0F]',
  praise: 'border-go bg-[#E3F1EA] text-go',
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
        <p
          className={`w-full rounded-3xl border-2 border-line bg-card px-5 py-4 font-display leading-snug text-ink ${bubbleClassName ?? 'text-xl sm:text-2xl'}`}
        >
          {text}
        </p>
        {note && (
          <p
            className={`w-full rounded-2xl border-2 px-4 py-3 font-display text-base font-semibold leading-snug sm:text-lg ${NOTE_STYLES[note.tone]}`}
          >
            {note.text}
          </p>
        )}
      </div>
    </div>
  );
}
