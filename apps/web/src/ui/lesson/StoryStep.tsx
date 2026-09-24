import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import type { Lesson } from '@chess-kids/core';
import { useServices } from '../../app/store.ts';
import { tContent } from '../../content-text.ts';
import { MiniBoard } from '../board/MiniBoard.tsx';
import { SpeechBubble } from '../SpeechBubble.tsx';
import { CharacterCard } from './CharacterCard.tsx';
import { NextButton } from './NextButton.tsx';

export interface StoryStepProps {
  readonly lesson: Lesson;
  readonly onNext: () => void;
}

/** Story: meet the character, hear the rule, see its legal moves on a small static board. */
export function StoryStep({ lesson, onNext }: StoryStepProps): JSX.Element {
  const { t } = useTranslation();
  const services = useServices();
  const { demo } = lesson;
  const dots = services.rules
    .legalMoves(demo.position, { staticOpponent: true }, demo.highlight.legalMovesFrom)
    .map((move) => move.to);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 overflow-y-auto py-2 sm:flex-row sm:gap-12">
      <CharacterCard character={lesson.character} />
      <div className="flex w-full max-w-xl flex-col gap-6">
        <SpeechBubble
          narrator={services.narrator}
          text={tContent(t, lesson.storyKey)}
          replayLabel={t('story.listen-again')}
        />
        <div className="flex items-end gap-6">
          <div className="h-36 w-36 flex-shrink-0 sm:h-52 sm:w-52">
            <MiniBoard
              position={demo.position}
              highlightSquares={dots}
              label={t('lesson.board-label')}
            />
          </div>
          <NextButton onClick={onNext} label={t('story.primary')} className="flex-1" />
        </div>
      </div>
    </div>
  );
}
