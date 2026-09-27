import type { ChoiceDef } from '@chess-kids/core';
import type { ExerciseKindContent } from '../kind-content.ts';
import { compile } from './compile.ts';
import { refine, schema } from './schema.ts';

// No semantic `verify`: option-id uniqueness, answer membership and "text or piece" are all
// schema-level; the authored `verify` field itself is checked at compile time (`checkChoiceVerify`).
export const choice: ExerciseKindContent<ChoiceDef, typeof schema> = {
  type: 'choice',
  schema,
  refine,
  compile,
};
