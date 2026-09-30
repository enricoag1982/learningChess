import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Owl } from './Owl.tsx';
import { ReplayButton } from './ReplayButton.tsx';

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
  /** Game screens: the compact replay icon at the right end of the owl row, beside the bubble. */
  readonly onReplay?: () => void;
  /** Accessible name of that icon (default "Say it again"). */
  readonly replayLabel?: string;
}

/** Owl avatar + bubble; `note` is a second line inside the bubble under a thin divider: orange text for hints / errors,
 * green for praise, never a box of its own (docs/screens.md §1). Speaking is the caller's job (`useNarratedText`). */
export function SpeechBubble({
  text,
  note,
  avatarClassName,
  bubbleClassName,
  onReplay,
  replayLabel,
}: SpeechBubbleProps): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="flex items-start gap-3">
      {/* Stacked layouts: the wrapper dissolves and the replay icon ends the row (`order`); side
          column (`lg`): it sits under the avatar, so the bubble gets the whole remaining width. */}
      <div className="contents lg:flex lg:flex-col lg:items-center lg:gap-2">
        <Owl className={avatarClassName} />
        {onReplay && (
          <ReplayButton
            compact
            onClick={onReplay}
            label={replayLabel ?? t('exercise.replay')}
            className="order-2"
          />
        )}
      </div>
      <div className="relative order-1 min-w-0 flex-1">
        {/* The bubble's tail: a small rotated square, same fill, behind the left edge. */}
        <span
          aria-hidden="true"
          className="absolute top-4 -left-1.5 h-3 w-3 rotate-45 bg-[#F1EADA]"
        />
        <div className="info-flat relative w-full rounded-3xl bg-[#F1EADA] px-5 py-4 font-display leading-snug text-ink">
          <p className={bubbleClassName ?? 'text-xl sm:text-2xl'}>{text}</p>
          {note && (
            <p
              className={`mt-2 border-t border-current/25 pt-2 text-base font-semibold ${note.tone === 'praise' ? 'text-[#1F5A41]' : 'text-[#8C4012]'}`}
            >
              {note.text}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
