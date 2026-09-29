// Chess's `SubjectCore` + `AppConfig`: the concrete values every platform seam
// (`createSubjectRuntime`, `AppDeps.subject`/`app`) plugs in for this app. Chess-bound.
import { chessGameRecordOf } from './app/games.ts';
import {
  CHESS_SETTINGS_DEFAULTS,
  isValidComputerLevel,
  isValidPieceStyle,
} from './chess/settings.ts';
import { chessJsRules } from './chess/chessjs-rules.ts';
import {
  chessRewardFacts,
  chessConditionValue,
  type ChessRewardFacts,
} from './chess/facts/rewards.ts';
import type { PieceType } from './chess/types.ts';
import { createVariantRules } from './variant/rules.ts';
import type { VariantRules } from './variant/rules.ts';
import { EXERCISE_KINDS } from '../kinds/index.ts';
import { EXERCISE_NOTES } from './exercise/notes.ts';
import { staticMode } from '../modes/static/mode.ts';
import { versusMode } from '../modes/versus/mode.ts';
import { composeDefaultSettings } from '@learn/platform-core/domain/profile-settings';
import type { AppConfig, SubjectCore } from '@learn/platform-core/domain/subject';
import type { ProfileSettings } from '@learn/platform-core/domain/profile-settings';

/** The World-2 piece-lesson characters' pieces, Rhino .. Caterpillar: the one source `CHESS_CHARACTERS.topicKey`,
 * `character-meta.ts` and content's `voice-texts.ts` derive from. */
export const CHARACTER_PIECES: Readonly<Record<string, PieceType>> = {
  rhino: 'r',
  elephant: 'b',
  lioness: 'q',
  lion: 'k',
  horse: 'n',
  caterpillar: 'p',
};

/** The World-2 piece-lesson characters; key order is `animalFriends`' friend order. */
export const CHESS_CHARACTERS = Object.fromEntries(
  Object.entries(CHARACTER_PIECES).map(([character, piece]) => [
    character,
    { topicKey: `piece.${piece}` },
  ]),
);

/** Chess's `SubjectCore`: 8 exercise kinds, `static` / `versus` modes (`series` comes from `createSubjectRuntime`), its badge
 * facts, versus→GameRecord translation and animal friends. */
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
      (await import('./chess/settings-backup.ts')).chessSettingsBackupShape,
  },
};

/** The chess app's full default settings as a plain constant (the web store's initial / new-profile state). */
export const DEFAULT_PROFILE_SETTINGS: ProfileSettings = composeDefaultSettings(chessCore.settings);

/** Chess's storage / backup / parent-code identifiers. No `version`: it is the running build's, filled in by the
 * platform-web shell (`__APP_VERSION__`). */
export const CHESS_APP_CONFIG: Omit<AppConfig, 'version'> = {
  storagePrefix: 'chess-kids:',
  backupAppId: 'chess-kids',
  backupFilePrefix: 'chess-for-kids',
  parentCodeFilePrefix: 'chess-for-kids-parent-code',
};
