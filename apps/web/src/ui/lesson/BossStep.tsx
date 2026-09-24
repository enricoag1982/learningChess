import type { JSX } from 'react';
import type { Lesson, MiniGame } from '@chess-kids/core';
import { SeriesBossStep } from './SeriesBossStep.tsx';
import { StaticBossStep } from './StaticBossStep.tsx';

export interface BossStepProps {
  readonly lesson: Lesson;
  readonly game: MiniGame;
  readonly nextStepIndex: number;
}

/** The lesson's boss mini-game: dispatches by `game.mode` to a `static` capture game or a `series` of rounds. */
export function BossStep({ lesson, game, nextStepIndex }: BossStepProps): JSX.Element {
  if (game.mode === 'series') {
    return <SeriesBossStep lesson={lesson} game={game} nextStepIndex={nextStepIndex} />;
  }
  return <StaticBossStep lesson={lesson} game={game} nextStepIndex={nextStepIndex} />;
}
