import type { JSX } from 'react';
import type { Lesson, MiniGameBase, MiniGameStateBase } from '@learn/platform-core';

/** Overrides a boss step's end-of-play save + "continue" action, for reuse outside a lesson
 * (`MiniGameSessionScreen`). Left `undefined`, each step keeps its lesson behaviour. */
export interface BossPlaySession {
  /** Persists this play; replaces the lesson's own boss-result save. */
  readonly save: (state: MiniGameStateBase, durationMs: number) => Promise<void>;
  /** Label for the primary "continue" action once the play is saved. */
  readonly primaryLabel: string;
  /** Called once the play is saved and the primary action is tapped. */
  readonly onPrimary: () => void;
}

export interface BossStepProps<Game extends MiniGameBase = MiniGameBase> {
  readonly lesson: Lesson;
  readonly game: Game;
  /** Step index to resume at next; ignored when `session` is set (lesson-only). */
  readonly nextStepIndex: number;
  /** Set by a standalone mini-game session; see {@link BossPlaySession}. */
  readonly session?: BossPlaySession;
}

/** One mini-game mode's whole UI: its own boss step. Method syntax is deliberate, same reason as
 * `ExerciseKindUI`: bivariant parameter checking lets a precise `MiniGameModeUI<Game>` widen to the
 * registry's general shape with no cast. */
export interface MiniGameModeUI<Game extends MiniGameBase = MiniGameBase> {
  readonly mode: string;
  Step(props: BossStepProps<Game>): JSX.Element;
}
