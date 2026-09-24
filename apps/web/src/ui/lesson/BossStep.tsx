import type { JSX } from 'react';
import type { GameState, Lesson, MiniGame, SeriesGameState, VersusState } from '@chess-kids/core';
import { SeriesBossStep } from './SeriesBossStep.tsx';
import { StaticBossStep } from './StaticBossStep.tsx';
import { VersusStep } from './VersusStep.tsx';

/**
 * Overrides a boss step's own end-of-play save + "continue" action, for reuse outside a lesson
 * (the Play screen's standalone mini-game session, `MiniGameSessionScreen`). Left `undefined`,
 * each step keeps its lesson behaviour unchanged: `recordBossResult` and advancing to
 * `nextStepIndex`, with "Play again" offered only once the play did not win outright.
 */
export interface BossPlaySession {
  /** Persists this play; replaces the lesson's own boss-result save. */
  readonly save: (
    state: GameState | SeriesGameState | VersusState,
    durationMs: number,
  ) => Promise<void>;
  /** Label for the primary "continue" action once the play is saved. */
  readonly primaryLabel: string;
  /** Called once the play is saved and the primary action is tapped. */
  readonly onPrimary: () => void;
}

export interface BossStepProps {
  readonly lesson: Lesson;
  readonly game: MiniGame;
  /** Step index to resume at next; ignored when `session` is set (lesson-only). */
  readonly nextStepIndex: number;
  /** Set by a standalone mini-game session; see {@link BossPlaySession}. */
  readonly session?: BossPlaySession;
}

/** The lesson's boss mini-game: dispatches by `game.mode` to `static`, `series`, or `versus` (vs. the bot). */
export function BossStep({ lesson, game, nextStepIndex, session }: BossStepProps): JSX.Element {
  if (game.mode === 'series') {
    return (
      <SeriesBossStep lesson={lesson} game={game} nextStepIndex={nextStepIndex} session={session} />
    );
  }
  if (game.mode === 'versus') {
    return (
      <VersusStep lesson={lesson} game={game} nextStepIndex={nextStepIndex} session={session} />
    );
  }
  return (
    <StaticBossStep lesson={lesson} game={game} nextStepIndex={nextStepIndex} session={session} />
  );
}
