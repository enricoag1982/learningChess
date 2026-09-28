// Chess's `SubjectCore` + `AppConfig`: the concrete values every platform seam
// (`createSubjectRuntime`, `AppDeps.subject`/`app`) plugs in for this app. Chess-bound.
import { chessGameRecordOf } from './app/games.ts';
import {
  CHESS_SETTINGS_DEFAULTS,
  isValidComputerLevel,
  isValidPieceStyle,
} from './domain/chess/settings.ts';
import { chessJsRules } from './domain/chess/chessjs-rules.ts';
import {
  chessRewardFacts,
  chessConditionValue,
  type ChessRewardFacts,
} from './domain/chess/facts/rewards.ts';
import type { PieceType } from './domain/chess/index.ts';
import { EXERCISE_KINDS } from './domain/exercise/kinds/index.ts';
import { EXERCISE_NOTES } from './domain/exercise/notes.ts';
import { staticMode } from './domain/exercise/modes/static/mode.ts';
import { versusMode } from './domain/exercise/modes/versus/mode.ts';
import { composeDefaultSettings } from './domain/profile-settings.ts';
import type { AppConfig, SubjectCore } from './domain/subject.ts';
import type { ProfileSettings } from './domain/profile-settings.ts';
import { createVariantRules, type VariantRules } from './domain/variant/index.ts';

/** The World-2 piece-lesson characters' own piece, Rhino .. Caterpillar — the one source both
 * `CHESS_CHARACTERS.topicKey` (below) and the web's `character-meta.ts`/content's
 * `voice-texts.ts` (each importing this instead of keeping their own copy) derive from. */
export const CHARACTER_PIECES: Readonly<Record<string, PieceType>> = {
  rhino: 'r',
  elephant: 'b',
  lioness: 'q',
  lion: 'k',
  horse: 'n',
  caterpillar: 'p',
};

/** The World-2 piece-lesson characters, Rhino .. Caterpillar — key order is `animalFriends`' own
 * friend order. Exported so `animalFriends`' callers can pass it in. */
export const CHESS_CHARACTERS = Object.fromEntries(
  Object.entries(CHARACTER_PIECES).map(([character, piece]) => [
    character,
    { topicKey: `piece.${piece}` },
  ]),
);

/** Chess's `SubjectCore`: today's 8 exercise kinds, the `static`/`versus` modes (`series` is added
 * by `createSubjectRuntime`, subject-free), its own badge facts (`game-win`/`game-event`/
 * `game-played`), its versus→GameRecord translation and animal friends. */
export const chessCore: SubjectCore<VariantRules, ChessRewardFacts> = {
  id: 'chess',
  context: createVariantRules(chessJsRules),
  kinds: EXERCISE_KINDS,
  modes: { static: staticMode, versus: versusMode },
  rewards: { facts: chessRewardFacts, conditionValue: chessConditionValue },
  gameRecordOf: chessGameRecordOf,
  characters: CHESS_CHARACTERS,
  notes: EXERCISE_NOTES,
  noteVars: (character) => ({ piece: CHARACTER_PIECES[character] ?? 'r' }),
  settings: {
    defaults: CHESS_SETTINGS_DEFAULTS,
    isValid: (s) => isValidComputerLevel(s.computerLevel) && isValidPieceStyle(s.pieceStyle),
    loadBackupShape: async () =>
      (await import('./domain/chess/settings-backup.ts')).chessSettingsBackupShape,
  },
};

/** The chess app's own full default settings, for code that needs a plain constant (the web
 * store's initial/new-profile state) rather than an `AppDeps` round trip. */
export const DEFAULT_PROFILE_SETTINGS: ProfileSettings = composeDefaultSettings(chessCore.settings);

/** Chess app's storage / backup / parent-code identifiers, read by `backup.ts`, `merge.ts`, web
 * `local-store.ts` and `download-password-file-writer.ts`. No `version`: that is the running
 * build's own, not the subject's — the platform-web shell fills it in (web: `__APP_VERSION__`). */
export const CHESS_APP_CONFIG: Omit<AppConfig, 'version'> = {
  storagePrefix: 'chess-kids:',
  backupAppId: 'chess-kids',
  backupFilePrefix: 'chess-for-kids',
  parentCodeFilePrefix: 'chess-for-kids-parent-code',
};
