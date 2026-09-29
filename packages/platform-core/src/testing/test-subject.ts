/**
 * `testSubject`: a tiny non-chess `SubjectCore` for platform tests — one `answer` kind (pick one of
 * N options; each wrong pick is an error; three hint levels) and no mode of its own (the platform
 * adds `series`) — plus builders for its defs, lessons and mini-games. `@learn/platform-core/testing`
 * only; no test of the platform imports a real subject.
 */
import { z } from 'zod';
import type { GameRecord } from '../domain/progress.ts';
import type { ExerciseKind } from '../domain/exercise/kind.ts';
import { errorHintStars } from '../domain/exercise/stars.ts';
import type { Lesson } from '../domain/lesson.ts';
import type {
  AppConfig,
  ExerciseDefBase,
  ExerciseStateBase,
  HintBase,
  MiniGameBase,
  SubjectCore,
} from '../domain/subject.ts';

/** Pick one of `options`; `correct` indexes the right one. */
export interface AnswerDef extends ExerciseDefBase {
  readonly type: 'answer';
  readonly options: readonly string[];
  readonly correct: number;
}

export type TestLesson = Lesson<AnswerDef>;

export interface TestMiniGame extends MiniGameBase {
  readonly mode: 'quiz';
  readonly par: number;
}

interface PickAction {
  readonly type: 'pick';
  readonly index: number;
}

interface AnswerHint extends HintBase {
  readonly kind: 'answer';
}

const answer: ExerciseKind<
  AnswerDef,
  ExerciseStateBase<AnswerDef>,
  PickAction,
  'right' | 'wrong',
  AnswerHint,
  null
> = {
  type: 'answer',
  input: 'answer',
  init: (def) => ({ def, moves: 0, solved: false, errors: 0, hintLevel: 0 }),
  act(state, action) {
    const right = action.index === state.def.correct;
    return {
      state: {
        ...state,
        moves: state.moves + 1,
        solved: state.solved || right,
        errors: right ? state.errors : state.errors + 1,
      },
      outcome: right ? 'right' : 'wrong',
    };
  },
  hint: (state, level) => ({
    state: { ...state, hintLevel: level },
    hint: { kind: 'answer', level },
  }),
  stars: (state) => errorHintStars(state.hintLevel, state.errors),
};

/** The subject's own badge facts: its won games (`game-win`, optionally against one `opponent`). */
const rewards: NonNullable<SubjectCore<null, readonly GameRecord[]>['rewards']> = {
  facts: (records) => records.filter((record) => record.result === 'win'),
  conditionValue: (condition, wins) =>
    condition.type === 'game-win'
      ? wins.filter(
          (win) =>
            condition.opponent === undefined ||
            condition.opponent === 'any' ||
            win.opponent === condition.opponent,
        ).length
      : undefined,
};

export const testSubject: SubjectCore<null, readonly GameRecord[]> = {
  id: 'test',
  context: null,
  kinds: { answer },
  modes: {},
  rewards,
  characters: {},
  settings: {
    defaults: { difficulty: 'easy' },
    isValid: (settings) => settings.difficulty === 'easy' || settings.difficulty === 'hard',
    loadBackupShape: () => Promise.resolve({ difficulty: z.enum(['easy', 'hard']) }),
  },
  notes: {},
  noteVars: () => ({}),
};

export const TEST_APP_CONFIG: AppConfig = {
  storagePrefix: 'test:',
  backupAppId: 'test-app',
  backupFilePrefix: 'test-app',
  parentCodeFilePrefix: 'test-app-parent-code',
  version: '0.0.0-test',
};

/** `AnswerDef` fixture: two options, the first right. `id` (default `exercise-1`) drives the
 * default `textKey` unless that is overridden too. */
export function makeExercise(overrides: Partial<AnswerDef> = {}): AnswerDef {
  const id = overrides.id ?? 'exercise-1';
  return {
    id,
    type: 'answer',
    concept: 'rook-move',
    textKey: `lessons:${id}`,
    options: ['a', 'b'],
    correct: 0,
    ...overrides,
  };
}

/** Lesson fixture: two exercises, no guided tries or boss. `id` (default `rook`) drives
 * `titleKey`/`storyKey`/`demo.textKey` and the default exercises' ids. */
export function makeLesson(overrides: Partial<TestLesson> = {}): TestLesson {
  const id = overrides.id ?? 'rook';
  return {
    id,
    world: 'pieces',
    order: 1,
    concept: 'rook-move',
    character: 'rhino',
    titleKey: `lessons:${id}.title`,
    storyKey: `lessons:${id}.story`,
    demo: { textKey: `lessons:${id}.demo` },
    guided: [],
    exercises: [makeExercise({ id: `${id}-01` }), makeExercise({ id: `${id}-02` })],
    ...overrides,
  };
}

/** Mini-game fixture: par 3, unlocked after the "rook" lesson. `id` (default `hungry-rook`) drives
 * the default `titleKey`/`goalKey`. */
export function makeMiniGame(overrides: Partial<TestMiniGame> = {}): TestMiniGame {
  const id = overrides.id ?? 'hungry-rook';
  return {
    mode: 'quiz',
    id,
    concept: 'rook-move',
    par: 3,
    titleKey: `minigames:${id}.title`,
    goalKey: `minigames:${id}.goal`,
    unlockAfter: 'rook',
    ...overrides,
  };
}
