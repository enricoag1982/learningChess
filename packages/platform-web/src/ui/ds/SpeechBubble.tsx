import type { JSX } from 'react';
import { Owl } from './Owl.tsx';

/** Visual tone for a note: orange for hints/errors, green for praise. Flat (docs/screens.md §1):
 * a left accent bar carries the tone, never a full box border. */
const NOTE_STYLES: Record<'attention' | 'praise', string> = {
  attention: 'border-l-4 border-today bg-[#FCEEE3] text-[#7A3A0F]',
  praise: 'border-l-4 border-go bg-[#E3F1EA] text-go',
};

export interface SpeechBubbleNote {
  readonly text: string;
  readonly tone: 'attention' | 'praise';
}

export interface SpeechBubbleProps {
  readonly text: string;
  /** A hint / error / praise line under the instruction; never replaces it (teaching-process.md §3.3). */
  readonly note?: SpeechBubbleNote;
  readonly avatarClassName?: string;
  readonly bubbleClassName?: string;
}

/** Owl avatar + bubble; `note` is a second line under `text`. Speaking is the caller's job (`useNarratedText` / `ReplayButton`). */
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
          {/* The bubble's tail: a small rotated square, same fill, behind the left edge. */}
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
