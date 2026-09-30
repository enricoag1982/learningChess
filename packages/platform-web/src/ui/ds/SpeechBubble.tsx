import type { JSX, ReactNode } from 'react';
import { Owl } from './Owl.tsx';

/** Colour of a note: orange for hints/errors, green for praise. The note sits inside the bubble
 * under a thin divider of the same colour, never in a box of its own (docs/screens.md §1). */
const NOTE_STYLES: Record<'attention' | 'praise', string> = {
  attention: 'border-[#7A3A0F]/25 text-[#7A3A0F]',
  praise: 'border-edge-go/25 text-edge-go',
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
  /** At the right end of the owl row, beside the bubble (game screens: the compact replay button). */
  readonly action?: ReactNode;
}

/** Owl avatar + bubble; `note` is a second line inside the bubble under `text`. Speaking is the caller's job (`useNarratedText` / `ReplayButton`). */
export function SpeechBubble({
  text,
  note,
  avatarClassName,
  bubbleClassName,
  action,
}: SpeechBubbleProps): JSX.Element {
  return (
    <div className="flex items-start gap-3">
      <Owl className={avatarClassName} />
      <div className="relative min-w-0 flex-1">
        {/* The bubble's tail: a small rotated square, same fill, behind the left edge. */}
        <span
          aria-hidden="true"
          className="absolute top-4 -left-1.5 h-3 w-3 rotate-45 bg-[#F1EADA]"
        />
        <div className="info-flat relative w-full rounded-3xl bg-[#F1EADA] px-5 py-4 font-display leading-snug text-ink">
          <p className={bubbleClassName ?? 'text-xl sm:text-2xl'}>{text}</p>
          {note && (
            <p className={`mt-2 border-t pt-2 text-base font-semibold ${NOTE_STYLES[note.tone]}`}>
              {note.text}
            </p>
          )}
        </div>
      </div>
      {action}
    </div>
  );
}
