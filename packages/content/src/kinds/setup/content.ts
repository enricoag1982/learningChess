import type { SetupDef } from '@chess-kids/core';
import type { ExerciseKindContent } from '../kind-content.ts';
import { compile } from './compile.ts';
import { schema } from './schema.ts';
import { verify } from './verify.ts';

export const setup: ExerciseKindContent<SetupDef, typeof schema> = {
  type: 'setup',
  schema,
  compile,
  verify,
  // Starts from an empty (or near-empty) board: no piece of the side to move is expected.
  needsKidPiece: () => false,
};
