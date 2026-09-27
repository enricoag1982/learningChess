import type { YesNoDef } from '@chess-kids/core';
import type { ExerciseKindContent } from '../kind-content.ts';
import { compile } from './compile.ts';
import { schema } from './schema.ts';

// No semantic `verify`: the schema already guarantees a boolean answer and a valid (optional)
// focus square; the authored `verify` field itself is checked at compile time (`checkYesNoVerify`).
export const yesNo: ExerciseKindContent<YesNoDef, typeof schema> = {
  type: 'yes-no',
  schema,
  compile,
};
