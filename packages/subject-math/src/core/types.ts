import type { ExerciseKind } from '@learn/platform-core/domain/exercise/kind';
import type {
  ChoiceDefBase,
  ChoiceHint,
  ChoiceOptionBase,
} from '@learn/platform-core/domain/exercise/kinds/choice/def';
import type { SeriesGameDef } from '@learn/platform-core/domain/exercise/modes/series/def';
import type {
  ExerciseDefBase,
  ExerciseStateBase,
  HintBase,
  Lesson,
  MiniGameBase,
} from '@learn/platform-core/domain/subject';

/** `a + b` or `a - b` over whole numbers; content keeps results within 0-20. */
export interface Problem {
  readonly a: number;
  readonly op: '+' | '-';
  readonly b: number;
}

/** The stimulus every math exercise shares: the problem card the kid looks at. */
export interface MathDefBase extends ExerciseDefBase {
  readonly problem?: Problem;
}

/** A pickable option: `textKey` text, a numeral `value`, or both. */
export interface MathChoiceOption extends ChoiceOptionBase {
  readonly value?: number;
}

/** An intersection, not `extends`: `MathDefBase.type` is any string, `ChoiceDefBase.type` is `'choice'`. */
export type MathChoiceDef = MathDefBase & ChoiceDefBase<MathChoiceOption>;

/** Type the answer (0-99) on a number pad. */
export interface NumberEntryDef extends MathDefBase {
  readonly type: 'number-entry';
  readonly answer: number;
}

export interface NumberEntryHint extends HintBase {
  readonly kind: 'number-entry';
  /** Set from level 2, for the "count on / back" wording. */
  readonly problem?: Problem;
  readonly reveal: boolean;
}

export type MathExerciseDef = MathChoiceDef | NumberEntryDef;

export type MathHint = ChoiceHint | NumberEntryHint;

/** `entry` is the digits typed so far (number-entry); `wrongOptions` the ruled-out options (choice). */
export interface MathState<
  D extends MathExerciseDef = MathExerciseDef,
> extends ExerciseStateBase<D> {
  readonly entry: string;
  readonly wrongOptions?: readonly string[];
}

export interface MathDemo {
  readonly textKey: string;
  readonly problem: Problem;
}

export type MathLesson = Lesson<MathExerciseDef, MathDemo>;

export interface MathSeriesGame extends MiniGameBase, SeriesGameDef<MathExerciseDef> {
  readonly mode: 'series';
}

export interface MathContent {
  readonly version: 1;
  readonly lessons: readonly MathLesson[];
  readonly minigames: readonly MathSeriesGame[];
}

export type MathKind<
  D extends MathExerciseDef,
  A extends { readonly type: string },
  O,
> = ExerciseKind<D, MathState<D>, A, O, MathHint, null>;
