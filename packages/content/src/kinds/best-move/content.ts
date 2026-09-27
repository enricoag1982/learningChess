import type { BestMoveDef } from '@chess-kids/core';
import type { ExerciseKindContent } from '../kind-content.ts';
import { compile } from './compile.ts';
import { schema } from './schema.ts';
import { verify } from './verify.ts';

export const bestMove: ExerciseKindContent<BestMoveDef, typeof schema> = {
  type: 'best-move',
  schema,
  compile,
  verify,
};
