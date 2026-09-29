// Math's `SubjectCore` + `AppConfig`: the concrete values every platform seam
// (`createSubjectRuntime`, `AppDeps.subject` / `app`) plugs in for this app.
import type { AppConfig, SubjectCore } from '@learn/platform-core/domain/subject';
import { MATH_KINDS } from '../kinds/index.ts';
import { MATH_NOTES } from './notes.ts';

/** Lesson characters that double as an "animal friend" once their lesson is done. */
export const MATH_CHARACTERS: Readonly<Record<string, { readonly topicKey: string }>> = {
  hedgehog: { topicKey: 'topic.counter' },
};

/** Math's `SubjectCore`: 2 exercise kinds and no mode of its own (`series` comes from `createSubjectRuntime`); no badge
 * facts, game log or settings slot. */
export const mathCore: SubjectCore<null> = {
  id: 'math',
  context: null,
  kinds: MATH_KINDS,
  modes: {},
  characters: MATH_CHARACTERS,
  notes: MATH_NOTES,
  noteVars: () => ({}),
  settings: {
    defaults: {},
    isValid: () => true,
    loadBackupShape: () => Promise.resolve({}),
  },
};

/** Math's storage / backup / parent-code identifiers. No `version`: it is the running build's, filled in by the
 * platform-web shell. */
export const MATH_APP_CONFIG: Omit<AppConfig, 'version'> = {
  storagePrefix: 'math-demo:',
  backupAppId: 'math-demo',
  backupFilePrefix: 'math-demo',
  parentCodeFilePrefix: 'math-demo-parent-code',
};
