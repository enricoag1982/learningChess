import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import type { Lesson } from '@chess-kids/core';
import { useServices } from '../../app/store.ts';
import { tContent } from '../../content-text.ts';
import { ReplayButton } from '../ReplayButton.tsx';
import { SpeechBubble } from '../SpeechBubble.tsx';
import { useIsCompact } from '../useMediaQuery.ts';
import { useNarratedText } from '../useNarratedText.ts';
import { MiniBoard } from '../board/MiniBoard.tsx';
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
  const isCompact = useIsCompact();
  const { demo } = lesson;
  const dots = services.rules
    .legalMoves(demo.position, { staticOpponent: true }, demo.highlight.legalMovesFrom)
    .map((move) => move.to);
  const text = tContent(t, lesson.storyKey);
  const replay = useNarratedText(services.narrator, text);

  const board = (
    <MiniBoard position={demo.position} highlightSquares={dots} label={t('lesson.board-label')} />
  );

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 overflow-y-auto py-2 sm:flex-row sm:gap-12">
      <CharacterCard character={lesson.character} />
      <div className="flex w-full max-w-xl flex-col gap-4 sm:gap-6">
        <SpeechBubble text={text} />
        {isCompact ? (
          <>
            {/* Mini board centred, capped width; then full-width buttons stacked (fix: phone Story
                layout — no squeezed two-line primary button next to a small board). */}
            <div className="mx-auto w-full max-w-[320px]">
              <div className="aspect-square w-full">{board}</div>
            </div>
            <ReplayButton onClick={replay} label={t('story.listen-again')} className="w-full" />
            <NextButton onClick={onNext} label={t('story.primary')} className="w-full" />
          </>
        ) : (
          <>
            <ReplayButton onClick={replay} label={t('story.listen-again')} />
            <div className="flex items-end gap-6">
              <div className="h-36 w-36 flex-shrink-0 sm:h-52 sm:w-52">{board}</div>
              <NextButton onClick={onNext} label={t('story.primary')} className="flex-1" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
