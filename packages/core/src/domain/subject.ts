// Platform base types (design-r4.md §2 `SubjectCore`): the subject-free shapes every exercise def /
// state / mini-game / lesson is built on. Pure TS, no chess import — a subject (chess, R5's math
// demo) supplies its own concrete types on top of these.
import type { ExerciseProgress } from './exercise/kind.ts';

/** Fields shared by every exercise definition, regardless of subject. */
export interface ExerciseDefBase {
  readonly id: string;
  readonly type: string;
  /** Concept id (e.g. `rook-move`), used for mastery and review tracking. */
  readonly concept: string;
  /** i18n key for the exercise's instruction text. */
  readonly textKey: string;
  /** Id of an entry in the lesson's `variants`, offered after enough errors on this exercise. */
  readonly easier?: string;
}

/** Fields shared by every exercise's runtime state, regardless of subject. */
export interface ExerciseStateBase<
  D extends ExerciseDefBase = ExerciseDefBase,
> extends ExerciseProgress {
  readonly def: D;
  readonly moves: number;
}

/** Fields shared by every kind's hint, regardless of subject. */
export interface HintBase {
  readonly kind: string;
  readonly level: 1 | 2 | 3;
}

/** Fields shared by every mini-game's content, regardless of subject or mode. */
export interface MiniGameBase {
  readonly id: string;
  readonly mode: string;
  readonly concept: string;
  readonly titleKey: string;
  readonly goalKey: string;
  /** Lesson id that unlocks this mini-game. */
  readonly unlockAfter: string;
}

/** Fields shared by every mini-game's runtime state, regardless of subject or mode. */
export interface MiniGameStateBase {
  readonly mode: string;
  readonly def: MiniGameBase;
}

/** One lesson: story, demo, guided tries, scored exercises, optional boss mini-game — generic over
 * the subject's own exercise def (`E`) and demo (`Demo`) shapes. */
export interface Lesson<
  E extends ExerciseDefBase = ExerciseDefBase,
  Demo extends { readonly textKey: string } = { readonly textKey: string },
> {
  readonly id: string;
  readonly world: string;
  readonly order: number;
  /** Concept id (e.g. `rook-move`), used for mastery and review tracking. */
  readonly concept: string;
  /** Character id (e.g. `rhino`); display name at `characters:<character>.name`. */
  readonly character: string;
  readonly titleKey: string;
  readonly storyKey: string;
  /** Id of the mini-game unlocked by completing this lesson. */
  readonly boss?: string;
  readonly demo: Demo;
  /** Easy tries shown before the exercises; hints on, not scored. */
  readonly guided: readonly E[];
  readonly exercises: readonly E[];
  /** Easier variants, reachable only via a scored exercise's `easier`; never stepped through,
   * scored or counted in completion / mastery. Absent = none. */
  readonly variants?: readonly E[];
}
