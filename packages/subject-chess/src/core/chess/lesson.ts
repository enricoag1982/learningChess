import type { Position, Square } from './types.ts';
import type { StaticCaptureGameDef } from '../../modes/static/def.ts';
import type { ExerciseDef } from '../exercise/types.ts';
import type { VersusGameDef } from '../../modes/versus/def.ts';
import type { Lesson as LessonBase, MiniGameBase } from '@learn/platform-core/domain/subject';

/** A demo's board highlight: every square one piece can reach from `legalMovesFrom` (most lessons), or explicit `squares`
 * (World 1: a row / column / diagonal, a corner, or nothing). */
export type DemoHighlight =
  { readonly legalMovesFrom: Square } | { readonly squares: readonly Square[] };

export interface LessonDemo {
  readonly position: Position;
  readonly textKey: string;
  readonly highlight: DemoHighlight;
}

export type Lesson = LessonBase<ExerciseDef, LessonDemo>;

export interface StaticMiniGame extends StaticCaptureGameDef, MiniGameBase {
  readonly mode: 'static';
}

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

export interface VersusMiniGame extends VersusGameDef, MiniGameBase {
  readonly mode: 'versus';
}

export type MiniGame = StaticMiniGame | SeriesMiniGame | VersusMiniGame;

export interface CompiledContent {
  readonly version: 1;
  readonly lessons: readonly Lesson[];
  readonly minigames: readonly MiniGame[];
}
