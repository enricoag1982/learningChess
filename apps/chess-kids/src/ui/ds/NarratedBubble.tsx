import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { useServices } from '../../app/store.ts';
import { SpeechBubble } from './SpeechBubble.tsx';
import { ReplayButton } from '@learn/platform-web/ui/ds/ReplayButton.tsx';
import { useSpeak } from '@learn/platform-web/ui/ds/useNarratedText.ts';

export type NarratedBubbleLayout = 'row' | 'center-row' | 'stack' | 'column';

const LAYOUT_WRAPPER: Readonly<Record<NarratedBubbleLayout, string>> = {
  row: 'flex flex-col gap-3 sm:flex-row sm:items-center',
  'center-row': 'flex flex-col items-center gap-3 sm:flex-row',
  stack: 'flex w-full max-w-md flex-col items-stretch gap-3',
  column: 'flex w-full flex-col items-stretch gap-3',
};

export interface NarratedBubbleProps {
  readonly text: string;
  readonly layout: NarratedBubbleLayout;
  readonly className?: string;
  readonly avatarClassName?: string;
  readonly bubbleClassName?: string;
  readonly replayClassName?: string;
  readonly replayLabel?: string;
  /** `'replay-only'`: speaks only when the replay button is pressed (default `'auto'`). */
  readonly speak?: 'auto' | 'replay-only';
}

/** Owl bubble + "Say it again" wired to the narrator. `layout` picks the wrapper shape; a screen
 * that places the bubble and replay button apart wires those two itself instead. */
export function NarratedBubble({
  text,
  layout,
  className = '',
  avatarClassName,
  bubbleClassName,
  replayClassName,
  replayLabel,
  speak = 'auto',
}: NarratedBubbleProps): JSX.Element {
  const { t } = useTranslation();
  const services = useServices();
  const replay = useSpeak(services.narrator, text, speak);
  return (
    <div className={`${LAYOUT_WRAPPER[layout]} ${className}`.trim()}>
      <SpeechBubble
        text={text}
        avatarClassName={avatarClassName}
        bubbleClassName={bubbleClassName}
      />
      <ReplayButton
        onClick={replay}
        label={replayLabel ?? t('exercise.replay')}
        className={replayClassName}
      />
    </div>
  );
}
