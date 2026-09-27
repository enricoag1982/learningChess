// Chess's `SubjectCore` + `AppConfig`: the concrete values every platform seam
// (`createSubjectRuntime`, `AppDeps.subject`/`app`) plugs in for this app. Chess-bound.
import { chessGameRecordOf } from './app/games.ts';
import { chessJsRules } from './domain/chess/chessjs-rules.ts';
import {
  chessRewardFacts,
  chessConditionValue,
  type ChessRewardFacts,
} from './domain/chess/facts/rewards.ts';
import { EXERCISE_KINDS } from './domain/exercise/kinds/index.ts';
import { staticMode } from './domain/exercise/modes/static/mode.ts';
import { versusMode } from './domain/exercise/modes/versus/mode.ts';
import type { AppConfig, SubjectCore } from './domain/subject.ts';
import { createVariantRules, type VariantRules } from './domain/variant/index.ts';

/** The World-2 piece-lesson characters, Rhino .. Caterpillar — key order is `animalFriends`' own
 * friend order. Exported so `animalFriends`' callers can pass it in. */
export const CHESS_CHARACTERS = {
  rhino: { topicKey: 'piece.r' },
  elephant: { topicKey: 'piece.b' },
  lioness: { topicKey: 'piece.q' },
  lion: { topicKey: 'piece.k' },
  horse: { topicKey: 'piece.n' },
  caterpillar: { topicKey: 'piece.p' },
};

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
};

/** Chess app's storage / backup / parent-code identifiers, read by `backup.ts`, `merge.ts`, web
 * `local-store.ts` and `download-password-file-writer.ts`. No `version`: that is the running
 * build's own, not the subject's — the platform-web shell fills it in (web: `__APP_VERSION__`). */
export const CHESS_APP_CONFIG: Omit<AppConfig, 'version'> = {
  storagePrefix: 'chess-kids:',
  backupAppId: 'chess-kids',
  backupFilePrefix: 'chess-for-kids',
  parentCodeFilePrefix: 'chess-for-kids-parent-code',
};
