import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import type { Lesson } from '@learn/platform-core';
import { useServices } from '../../app/store.ts';
import { usePack } from '../../app/subject.ts';
import { tContent } from '../../content-text.ts';
import { SpeechBubble } from '../ds/SpeechBubble.tsx';
import { useIsCompact } from '../useMediaQuery.ts';
import { useNarratedText } from '../ds/useNarratedText.ts';
import { CharacterCard } from './CharacterCard.tsx';
import { ForwardRow } from './ForwardRow.tsx';

export interface StoryStepProps {
  readonly lesson: Lesson;
  readonly onNext: () => void;
  readonly onSkip: () => void;
}

/** Meet the character, hear the rule, see its legal moves on a small static board (the subject's `surface.Story`). */
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
        <SpeechBubble text={text} onReplay={replay} replayLabel={t('story.listen-again')} />
        {isCompact ? (
          <>
            {/* Mini board centred, capped width; buttons pinned to the bottom so the primary is
                always in view on a phone (playtest 2: it sat below the fold). */}
            <pack.surface.Story lesson={lesson} compact />
            <ForwardRow
              onSkip={onSkip}
              onNext={onNext}
              label={t('story.primary')}
              className="sticky bottom-0 bg-cream pt-2 pb-1"
            />
          </>
        ) : (
          <>
            <div className="flex items-end gap-6">
              <pack.surface.Story lesson={lesson} compact={false} />
              <ForwardRow
                onSkip={onSkip}
                onNext={onNext}
                label={t('story.primary')}
                className="flex-1"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
