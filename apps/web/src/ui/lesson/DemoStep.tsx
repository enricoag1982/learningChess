import { useState } from 'react';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import type { Lesson, Position, Square } from '@chess-kids/core';
import { useServices } from '../../app/store.ts';
import { characterName, tContent } from '../../content-text.ts';
import { Board } from '../board/Board.tsx';
import { SpeechBubble } from '../SpeechBubble.tsx';
import { GameLayout } from './GameLayout.tsx';
import { NextButton } from './NextButton.tsx';

export interface DemoStepProps {
  readonly lesson: Lesson;
  readonly onNext: () => void;
}

/** Free play with the lesson's piece: every legal move is open, nothing is scored. */
export function DemoStep({ lesson, onNext }: DemoStepProps): JSX.Element {
  const { t } = useTranslation();
  const services = useServices();
  const [position, setPosition] = useState<Position>(lesson.demo.position);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | undefined>(undefined);

  const legalMoves = services.rules.legalMoves(position, { staticOpponent: true });

  function handleMove(move: { from: Square; to: Square }): void {
    const played = services.rules.play(position, { staticOpponent: true }, move);
    if (!played) return;
    setPosition(played.position);
    setLastMove(move);
  }

  return (
    <GameLayout
      board={
        <Board
          position={position}
          legalMoves={legalMoves}
          onMove={handleMove}
          highlights={lastMove ? { lastMove } : undefined}
          label={t('demo.board-label', { name: characterName(t, lesson.character) })}
        />
      }
      panel={
        <>
          <SpeechBubble
            narrator={services.narrator}
            text={tContent(t, lesson.demo.textKey)}
            replayLabel={t('exercise.replay')}
          />
          <NextButton onClick={onNext} className="mt-auto" />
        </>
      }
    />
  );
}
