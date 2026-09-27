// Platform base types (design-r4.md §2 `SubjectCore`): the subject-free shapes every exercise def /
// state / mini-game / lesson is built on. Pure TS, no chess import — a subject (chess, R5's math
// demo) supplies its own concrete types on top of these.
import type { SubjectRewards } from './badges.ts';
import type { ExerciseKind, ExerciseProgress } from './exercise/kind.ts';
import type { MiniGameMode } from './exercise/mode.ts';
import type { GameRecordResult } from './progress.ts';

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

/** Fields shared by every mini-game's runtime state, regardless of subject or mode. `def` is only
 * `{id}` here (not the full `MiniGameBase`): a mode's own play-time def (`StaticCaptureGameDef`,
 * `VersusGameDef`, …) deliberately omits the catalog fields (title/goal/unlockAfter), which the
 * boss/Play screen already has from the content lesson/mini-game, not the running state. */
export interface MiniGameStateBase {
  readonly mode: string;
  readonly def: { readonly id: string };
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

/** Any exercise kind, widened to the base def/state/hint shapes plus the subject's own kind context. */
export type AnyKind<Ctx> = ExerciseKind<
  ExerciseDefBase,
  ExerciseStateBase,
  { readonly type: string },
  unknown,
  HintBase,
  Ctx
>;

/** Any mini-game mode, widened to the base state shape. `Def` (a mode's own `start(def)` input) is
 * `unknown`: platform code never starts a mini-game generically, only reads its running state
 * (`isOver`/`isWin`/`stars`/`summarise`) — starting stays each mode's own concrete function
 * (`startStaticCaptureGame`, `startSeries`, `startVersus`). */
export type AnyMode = MiniGameMode<unknown, MiniGameStateBase>;

/** One `GameRecord` to save (`app/games.ts`'s `recordGame`, the Play/boss "versus finished" path):
 * `opponent` is the already-formatted string (chess: `'computer:<level>'`) — the platform never
 * knows how a subject names its opponents. */
export interface RecordGameInput {
  readonly profileId: string;
  /** `'full'` for a full standard game, else a `versus` mini-game's content id. */
  readonly game: string;
  readonly opponent: string;
  readonly result: GameRecordResult;
  readonly reason: string;
  readonly moves: readonly string[];
}

/** One subject's whole behaviour behind the platform's uniform interfaces (design-r4.md §2).
 * `rewards`/`gameRecordOf` are optional: a subject without badge facts or its own game log simply
 * omits them (R5's math demo). */
export interface SubjectCore<Ctx = unknown, F = unknown> {
  /** e.g. `'chess'`. */
  readonly id: string;
  /** The kind context every `ExerciseKind.act`/`hint` call receives (chess: `VariantRules`). */
  readonly context: Ctx;
  readonly kinds: Readonly<Record<string, AnyKind<Ctx>>>;
  /** `static`/`versus`-shaped modes; `createSubjectRuntime` adds the platform `series` mode. */
  readonly modes: Readonly<Record<string, AnyMode>>;
  /** The subject's own facts for badge condition types the engine's 7 generic ones don't cover
   * (chess: `game-win`/`game-event`/`game-played`). */
  readonly rewards?: SubjectRewards<F>;
  /** `game`/`state`'s own `GameRecord`, or `null` for a mode/state with no game log (chess:
   * `static`/`series`) — the versus→GameRecord translation `app/minigames.ts` used to hardcode. */
  gameRecordOf?(
    game: MiniGameBase,
    state: MiniGameStateBase,
  ): Omit<RecordGameInput, 'profileId'> | null;
}

/** App-level values a subject's platform-web shell needs, kept out of storage/backup so swapping
 * subjects never collides on disk (design-r4.md §2; values unchanged from today's chess app). */
export interface AppConfig {
  /** localStorage key prefix, e.g. `'chess-kids:'`. */
  readonly storagePrefix: string;
  /** Backup file's `app` field, e.g. `'chess-kids'`. */
  readonly backupAppId: string;
  /** Downloaded backup file name prefix. */
  readonly backupFilePrefix: string;
  /** Downloaded parent-code file name prefix. */
  readonly parentCodeFilePrefix: string;
  readonly version: string;
}
