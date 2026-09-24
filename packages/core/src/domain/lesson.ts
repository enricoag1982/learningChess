import type { Position, Square } from './chess/types.ts';
import type { StaticCaptureGameDef } from './exercise/minigame.ts';
import type { ExerciseDef } from './exercise/types.ts';

/** A demo's legal-move highlight: every square one piece can reach from `legalMovesFrom`. */
export interface DemoHighlight {
  readonly legalMovesFrom: Square;
}

/** Legal-moves demo shown before the guided tries. */
export interface LessonDemo {
  readonly position: Position;
  /** i18n key for the demo's spoken text. */
  readonly textKey: string;
  readonly highlight: DemoHighlight;
}

/** One lesson: story, demo, guided tries, scored exercises, optional boss mini-game. */
export interface Lesson {
  readonly id: string;
  readonly world: string;
  readonly order: number;
  /** Concept id (e.g. `rook-move`), used for mastery and review tracking. */
  readonly concept: string;
  /** Character id (e.g. `rhino`); display name at `characters:<character>.name`. */
  readonly character: string;
  readonly titleKey: string;
  readonly storyKey: string;
  readonly demo: LessonDemo;
  /** Easy tries shown before the exercises; hints on, not scored. */
  readonly guided: readonly ExerciseDef[];
  readonly exercises: readonly ExerciseDef[];
  /** Id of the mini-game unlocked by completing this lesson. */
  readonly boss?: string;
}

/** Mini-game content: a static-capture game plus its lesson-facing text and unlock rule. */
export interface MiniGame extends StaticCaptureGameDef {
  readonly titleKey: string;
  readonly goalKey: string;
  /** Lesson id that unlocks this mini-game. */
  readonly unlockAfter: string;
}

/** Whole compiled content bundle written to `content.json`. */
export interface CompiledContent {
  readonly version: 1;
  readonly lessons: readonly Lesson[];
  readonly minigames: readonly MiniGame[];
}
