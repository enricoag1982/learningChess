// Chess's `SubjectCore` + `AppConfig` (design-r4.md §2, C4): the concrete values every platform
// seam (`createSubjectRuntime`, `AppDeps.subject`/`app`) plugs in for this app. Chess-bound —
// m8.17 moves this file into `subject-chess` unchanged.
import { chessJsRules } from './domain/chess/chessjs-rules.ts';
import { EXERCISE_KINDS } from './domain/exercise/kinds/index.ts';
import { staticMode } from './domain/exercise/modes/static/mode.ts';
import { versusMode } from './domain/exercise/modes/versus/mode.ts';
import type { AppConfig, SubjectCore } from './domain/subject.ts';
import { createVariantRules, type VariantRules } from './domain/variant/index.ts';

/** Chess's `SubjectCore`: today's 8 exercise kinds and the `static`/`versus` modes (`series` is
 * added by `createSubjectRuntime`, subject-free). */
export const chessCore: SubjectCore<VariantRules> = {
  id: 'chess',
  context: createVariantRules(chessJsRules),
  kinds: EXERCISE_KINDS,
  modes: { static: staticMode, versus: versusMode },
};

/** Chess app's storage / backup / parent-code identifiers — unchanged from today's hardcoded
 * literals (`backup.ts`, `merge.ts`, web `local-store.ts`, `download-password-file-writer.ts`). */
export const CHESS_APP_CONFIG: AppConfig = {
  storagePrefix: 'chess-kids:',
  backupAppId: 'chess-kids',
  backupFilePrefix: 'chess-for-kids',
  parentCodeFilePrefix: 'chess-for-kids-parent-code',
  // The app's own build stamps this from `__APP_VERSION__` once `AppDeps.app` is wired in
  // (docs/refactor-v4.md §4 "Build and tooling"); unused until then.
  version: '2.0.0',
};
