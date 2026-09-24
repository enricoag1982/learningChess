import type { Position, Square } from './chess/types.ts';
import type { StaticCaptureGameDef } from './exercise/minigame.ts';
import type { ExerciseDef } from './exercise/types.ts';
import type { VersusGameDef } from './exercise/versus.ts';

/**
 * A demo's board highlight: every square one piece can reach from `legalMovesFrom` (most lessons),
 * or an explicit list of `squares` (World 1: a row/column/diagonal, a corner, or nothing at all).
 */
export type DemoHighlight =
  { readonly legalMovesFrom: Square } | { readonly squares: readonly Square[] };

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
  /** Easier variants, reachable only via a scored exercise's `easier`; never stepped through, scored or counted in completion / mastery. Absent = none. */
  readonly variants?: readonly ExerciseDef[];
  /** Id of the mini-game unlocked by completing this lesson. */
  readonly boss?: string;
}

/** Fields every mini-game's content shares, regardless of `mode`. */
interface MiniGameBase {
  readonly titleKey: string;
  readonly goalKey: string;
  /** Lesson id that unlocks this mini-game. */
  readonly unlockAfter: string;
}

/** Static-opponent mini-game (Hungry Piece, Knight Maze, King Walk, …): unchanged since M1.2. */
export interface StaticMiniGame extends StaticCaptureGameDef, MiniGameBase {
  readonly mode: 'static';
}

/** Series mini-game (Square Hunt, Setup Race, and M3's Safe or Not? / Escape the Check / …). */
export interface SeriesMiniGame extends MiniGameBase {
  readonly mode: 'series';
  readonly id: string;
  readonly concept: string;
  readonly rounds: readonly ExerciseDef[];
  /** Total mistakes (errors + hint levels) across all rounds at/under which the boss earns 3 stars. */
  readonly errors3: number;
  /** …2 stars threshold; `errors2 >= errors3`. */
  readonly errors2: number;
}

/** `versus` mini-game (Pawn Wars, …): variant rules played against the computer opponent (M2.6). */
export interface VersusMiniGame extends VersusGameDef, MiniGameBase {
  readonly mode: 'versus';
}

/** Mini-game content: `static` (capture-all / collect-stars), `series` (M2.4), or `versus` (M2.6). */
export type MiniGame = StaticMiniGame | SeriesMiniGame | VersusMiniGame;

/** Whole compiled content bundle written to `content.json`. */
export interface CompiledContent {
  readonly version: 1;
  readonly lessons: readonly Lesson[];
  readonly minigames: readonly MiniGame[];
}
