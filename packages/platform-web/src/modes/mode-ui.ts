import type { JSX } from 'react';
import type { Lesson, MiniGameBase, MiniGameStateBase } from '@learn/platform-core';

/** Overrides a boss step's end-of-play save + "continue" action, for reuse outside a lesson
 * (`MiniGameSessionScreen`). Left `undefined`, each step keeps its lesson behaviour. */
export interface BossPlaySession {
  readonly save: (state: MiniGameStateBase, durationMs: number) => Promise<void>;
  readonly primaryLabel: string;
  readonly onPrimary: () => void;
}

export interface BossStepProps<Game extends MiniGameBase = MiniGameBase> {
  readonly lesson: Lesson;
  readonly game: Game;
  /** Step index to resume at next; ignored when `session` is set (lesson-only). */
  readonly nextStepIndex: number;
  readonly session?: BossPlaySession;
}

/** One mini-game mode's whole UI: its boss step. Method syntax: bivariance lets a precise `MiniGameModeUI<Game>` widen with no cast. */
export interface MiniGameModeUI<Game extends MiniGameBase = MiniGameBase> {
  readonly mode: string;
  Step(props: BossStepProps<Game>): JSX.Element;
}
