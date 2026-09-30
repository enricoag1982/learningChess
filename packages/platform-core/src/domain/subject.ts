// Platform base types: the subject-free shapes every exercise def / state / mini-game / lesson is
// built on. Pure TS, no chess import — a subject supplies its own concrete types on top of these.
import type { ZodType } from 'zod';
import type { SubjectRewards } from './badges.ts';
import type { ExerciseKind, ExerciseProgress } from './exercise/kind.ts';
import type { MiniGameMode } from './exercise/mode.ts';
import type { AnyNoteEntry } from './notes.ts';
import type { GameRecordResult } from './progress.ts';

export interface ExerciseDefBase {
  readonly id: string;
  readonly type: string;
  /** Concept id (e.g. `rook-move`), used for mastery and review tracking. */
  readonly concept: string;
  readonly textKey: string;
  /** Id of an entry in the lesson's `variants`, offered after enough errors on this exercise. */
  readonly easier?: string;
}

export interface ExerciseStateBase<
  D extends ExerciseDefBase = ExerciseDefBase,
> extends ExerciseProgress {
  readonly def: D;
  readonly moves: number;
}

export interface HintBase {
  readonly kind: string;
  readonly level: 1 | 2 | 3;
}

export interface MiniGameBase {
  readonly id: string;
  readonly mode: string;
  readonly concept: string;
  readonly titleKey: string;
  readonly goalKey: string;
  readonly unlockAfter: string;
}

/** `def` is only `{id}`: a mode's play-time def omits the catalog fields (title/goal/unlockAfter), which the
 * boss/Play screen already has from content. */
export interface MiniGameStateBase {
  readonly mode: string;
  readonly def: { readonly id: string };
}

/** One lesson: story, demo, guided tries, scored exercises, optional boss; generic over the subject's exercise def `E` and demo `Demo`. */
export interface Lesson<
  E extends ExerciseDefBase = ExerciseDefBase,
  Demo extends { readonly textKey: string } = { readonly textKey: string },
> {
  readonly id: string;
  readonly world: string;
  readonly order: number;
  readonly concept: string;
  /** Character id (e.g. `rook`); display name at `characters:<character>.name`. */
  readonly character: string;
  readonly titleKey: string;
  readonly storyKey: string;
  readonly boss?: string;
  readonly demo: Demo;
  /** Easy tries shown before the exercises; hints on, not scored. */
  readonly guided: readonly E[];
  readonly exercises: readonly E[];
  /** Easier variants, reachable only via a scored exercise's `easier`; never stepped through,
   * scored or counted in completion / mastery. Absent = none. */
  readonly variants?: readonly E[];
}

export type AnyKind<Ctx> = ExerciseKind<
  ExerciseDefBase,
  ExerciseStateBase,
  { readonly type: string },
  unknown,
  HintBase,
  Ctx
>;

/** Any mini-game mode over the base state. `Def` is `unknown`: platform code only reads running state, never starts a
 * mini-game generically (each mode has its own `start*` function). */
export type AnyMode = MiniGameMode<unknown, MiniGameStateBase>;

/** One `GameRecord` to save (`app/games.ts`'s `recordGame`): `opponent` is pre-formatted (chess: `'computer:<level>'`),
 * the platform never knows a subject's naming. */
export interface RecordGameInput {
  readonly profileId: string;
  readonly game: string;
  readonly opponent: string;
  readonly result: GameRecordResult;
  readonly reason: string;
  readonly moves: readonly string[];
}

/** One subject's whole behaviour behind the platform interfaces. `rewards`/`gameRecordOf` are optional: a subject
 * without badge facts or its own game log omits them. */
export interface SubjectCore<Ctx = unknown, F = unknown> {
  readonly id: string;
  /** The kind context every `ExerciseKind.act`/`hint` call receives (chess: `VariantRules`). */
  readonly context: Ctx;
  readonly kinds: Readonly<Record<string, AnyKind<Ctx>>>;
  /** `static`/`versus`-shaped modes; `createSubjectRuntime` adds the platform `series` mode. */
  readonly modes: Readonly<Record<string, AnyMode>>;
  /** The subject's own facts for badge condition types the engine's 7 generic ones don't cover
   * (chess: `game-win`/`game-event`/`game-played`). */
  readonly rewards?: SubjectRewards<F>;
  /** The `GameRecord` of a finished mini-game state, or `null` for a mode without a game log (chess: `static`/`series`). */
  gameRecordOf?(
    game: MiniGameBase,
    state: MiniGameStateBase,
  ): Omit<RecordGameInput, 'profileId'> | null;
  /** Lesson characters that double as a "friend" once their lesson is done (`rook` → `piece.r`), in
   * `animalFriends` order; an absent id (Owl) is never a friend. */
  readonly characters: Readonly<Record<string, { readonly topicKey: string }>>;
  /** The subject's settings-slot fields as an opaque bag: `defaults` composes into `ProfileSettings`, `isValid` checks a
   * stored one, `loadBackupShape` (dynamic import) supplies the zod fields for `app/backup.ts`. */
  readonly settings: {
    readonly defaults: Readonly<Record<string, unknown>>;
    /** Fields an older version stored and this one no longer has: a stored one loads, is ignored, and is dropped on the next save. */
    readonly retired?: readonly string[];
    /** Constant fields every exported profile's settings carry, write-only (import ignores them): an older version's importer
     * still requires them, so it still accepts files from this build. */
    readonly legacyExport?: Readonly<Record<string, unknown>>;
    isValid(s: Readonly<Record<string, unknown>>): boolean;
    loadBackupShape(): Promise<SettingsBackupShape>;
  };
  /** Every feedback kind's note, keyed by `ExerciseFeedbackBase['kind']`: the subject's own kinds plus the
   * platform-shaped ones (tap-first, wrong-answer, hint, solved). */
  readonly notes: Readonly<Record<string, AnyNoteEntry>>;
  /** Extra note vars for `character` beyond `{name, stars}` (chess: `{ piece }`). */
  noteVars(character: string): Readonly<Record<string, string>>;
}

/** A subject's backup zod fields, spliced into `app/backup.ts`'s settings shape. */
export type SettingsBackupShape = Readonly<Record<string, ZodType>>;

export interface AppConfig {
  /** localStorage key prefix, e.g. `'chess-kids:'`. */
  readonly storagePrefix: string;
  /** Backup file's `app` field, e.g. `'chess-kids'`. */
  readonly backupAppId: string;
  readonly backupFilePrefix: string;
  readonly parentCodeFilePrefix: string;
  /** The running build's own version string (web: `__APP_VERSION__`, from `package.json`). */
  readonly version: string;
}
