import type { CollectStarsDef } from '@chess-kids/core';
import type { ExerciseKindContent } from '../kind-content.ts';
import { compile } from './compile.ts';
import { schema } from './schema.ts';
import { verify } from './verify.ts';

export const collectStars: ExerciseKindContent<CollectStarsDef, typeof schema> = {
  type: 'collect-stars',
  schema,
  compile,
  verify,
};
