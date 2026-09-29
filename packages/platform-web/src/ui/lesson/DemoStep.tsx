import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import type { Lesson } from '@learn/platform-core';
import { useServices } from '../../app/store.ts';
import { usePack } from '../../app/subject.ts';
import { tContent } from '../../content-text.ts';
import { ReplayButton } from '../ds/ReplayButton.tsx';
import { SpeechBubble } from '../ds/SpeechBubble.tsx';
import { useNarratedText } from '../ds/useNarratedText.ts';
import { GameLayout } from './GameLayout.tsx';
import { NextButton } from './NextButton.tsx';
import { SkipButton } from './SkipButton.tsx';

export interface DemoStepProps {
  readonly lesson: Lesson;
  readonly onNext: () => void;
  /** "Skip" goes to Try (or Exercises when the lesson has no guided tries). */
  readonly onSkip: () => void;
}

/** Free play with the lesson's piece: every legal move is open, nothing scored (the board is the subject's `surface.Demo`). */
export function DemoStep({ lesson, onNext, onSkip }: DemoStepProps): JSX.Element {
  const { t } = useTranslation();
  const services = useServices();
  const pack = usePack();
  const text = tContent(t, lesson.demo.textKey);
  const replay = useNarratedText(services.narrator, text);

  return (
    <GameLayout
      board={<pack.surface.Demo lesson={lesson} />}
      panel={
        <>
          <SpeechBubble text={text} />
          {/* Skip sits beside Replay (same place as on Story / Try), never beside the primary. */}
          <div className="flex gap-3">
            <ReplayButton onClick={replay} label={t('exercise.replay')} className="flex-1" />
            <SkipButton onClick={onSkip} />
          </div>
          <NextButton onClick={onNext} className="mt-auto w-full" />
        </>
      }
    />
  );
}
