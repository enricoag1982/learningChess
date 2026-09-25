import { useState } from 'react';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import type { Lesson, Position, Square } from '@chess-kids/core';
import { useAppStore, useServices } from '../../app/store.ts';
import { characterName, tContent } from '../../content-text.ts';
import { Board } from '../board/Board.tsx';
import { isClassicOnlyContext, showPieceBadges } from '../board/piece-style.ts';
import { ReplayButton } from '../ReplayButton.tsx';
import { SpeechBubble } from '../SpeechBubble.tsx';
import { useNarratedText } from '../useNarratedText.ts';
import { GameLayout } from './GameLayout.tsx';
import { NextButton } from './NextButton.tsx';
import { SkipButton } from './SkipButton.tsx';

export interface DemoStepProps {
  readonly lesson: Lesson;
  readonly onNext: () => void;
  /** "Skip" (playtest 2): skips straight to Try (or Exercises if the lesson has no guided tries). */
  readonly onSkip: () => void;
}

/** Free play with the lesson's piece: every legal move is open, nothing is scored. */
export function DemoStep({ lesson, onNext, onSkip }: DemoStepProps): JSX.Element {
  const { t } = useTranslation();
  const services = useServices();
  const pieceStyle = useAppStore((state) => state.activeProfileSettings.pieceStyle);
  const [position, setPosition] = useState<Position>(lesson.demo.position);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | undefined>(undefined);
  const text = tContent(t, lesson.demo.textKey);
  const replay = useNarratedText(services.narrator, text);
  const pieceBadges = showPieceBadges(pieceStyle, isClassicOnlyContext({ worldId: lesson.world }));

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
          pieceBadges={pieceBadges}
        />
      }
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
