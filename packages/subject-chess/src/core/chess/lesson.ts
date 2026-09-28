import type { Position, Square } from './types.ts';
import type { StaticCaptureGameDef } from '../../modes/static/def.ts';
import type { ExerciseDef } from '../exercise/types.ts';
import type { VersusGameDef } from '../../modes/versus/def.ts';
import type { Lesson as LessonBase, MiniGameBase } from '@learn/platform-core/domain/subject';

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

/** One lesson: story, demo, guided tries, scored exercises, optional boss mini-game. The chess
 * instantiation of the platform's generic `Lesson<E, Demo>` (`subject.ts`); shape unchanged. */
export type Lesson = LessonBase<ExerciseDef, LessonDemo>;

/** Static-opponent mini-game (Hungry Piece, Knight Maze, King Walk, …). */
export interface StaticMiniGame extends StaticCaptureGameDef, MiniGameBase {
  readonly mode: 'static';
}

/** Series mini-game (Square Hunt, Setup Race, Safe or Not?, Escape the Check, …). */
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

/** `versus` mini-game (Pawn Wars, …): variant rules played against the computer opponent. */
export interface VersusMiniGame extends VersusGameDef, MiniGameBase {
  readonly mode: 'versus';
}

/** Mini-game content: `static` (capture-all / collect-stars), `series`, or `versus`. */
export type MiniGame = StaticMiniGame | SeriesMiniGame | VersusMiniGame;

/** Whole compiled content bundle written to `content.json`. */
export interface CompiledContent {
  readonly version: 1;
  readonly lessons: readonly Lesson[];
  readonly minigames: readonly MiniGame[];
}
