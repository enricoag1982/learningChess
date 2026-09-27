import type { MateInNDef } from '@chess-kids/core';
import type { ExerciseKindContent } from '../kind-content.ts';
import { compile } from './compile.ts';
import { schema } from './schema.ts';
import { verify } from './verify.ts';

export const mateInN: ExerciseKindContent<MateInNDef, typeof schema> = {
  type: 'mate-in-n',
  schema,
  compile,
  verify,
};
