import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import type { Lesson } from '@learn/platform-core';
import { useServices } from '../../app/store.ts';
import { usePack } from '../../app/subject.ts';
import { tContent } from '../../content-text.ts';
import { ReplayButton } from '../ds/ReplayButton.tsx';
import { SpeechBubble } from '../ds/SpeechBubble.tsx';
import { useIsCompact } from '../useMediaQuery.ts';
import { useNarratedText } from '../ds/useNarratedText.ts';
import { CharacterCard } from './CharacterCard.tsx';
import { NextButton } from './NextButton.tsx';
import { SkipButton } from './SkipButton.tsx';

export interface StoryStepProps {
  readonly lesson: Lesson;
  readonly onNext: () => void;
  /** "Skip" (playtest 2): skips straight to Demo. */
  readonly onSkip: () => void;
}

/** Story: meet the character, hear the rule, see its legal moves on a small static board (the
 * board itself is the subject's own `surface.Story`). */
export function StoryStep({ lesson, onNext, onSkip }: StoryStepProps): JSX.Element {
  const { t } = useTranslation();
  const services = useServices();
  const pack = usePack();
  const isCompact = useIsCompact();
  const text = tContent(t, lesson.storyKey);
  const replay = useNarratedText(services.narrator, text);

  return (
    <div className="flex flex-1 flex-col items-center justify-center-safe gap-6 overflow-y-auto py-2 sm:flex-row sm:gap-12">
      <CharacterCard character={lesson.character} />
      <div className="flex w-full max-w-xl flex-col gap-4 sm:gap-6">
        <SpeechBubble text={text} />
        {isCompact ? (
          <>
            {/* Mini board centred, capped width; buttons pinned to the bottom so the primary is
                always in view on a phone (playtest 2: it sat below the fold). */}
            <pack.surface.Story lesson={lesson} compact />
            <div className="sticky bottom-0 flex flex-col gap-3 bg-cream pt-2 pb-1">
              <div className="flex gap-3">
                <ReplayButton onClick={replay} label={t('story.listen-again')} className="flex-1" />
                <SkipButton onClick={onSkip} />
              </div>
              <NextButton onClick={onNext} label={t('story.primary')} className="w-full" />
            </div>
          </>
        ) : (
          <>
            <div className="flex gap-3">
              <ReplayButton onClick={replay} label={t('story.listen-again')} className="flex-1" />
              <SkipButton onClick={onSkip} />
            </div>
            <div className="flex items-end gap-6">
              <pack.surface.Story lesson={lesson} compact={false} />
              <NextButton onClick={onNext} label={t('story.primary')} className="flex-1" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
