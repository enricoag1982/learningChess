import type { CaptureDef } from '@chess-kids/core';
import type { ExerciseKindContent } from '../kind-content.ts';
import { compile } from './compile.ts';
import { schema } from './schema.ts';
import { verify } from './verify.ts';

export const capture: ExerciseKindContent<CaptureDef, typeof schema> = {
  type: 'capture',
  schema,
  compile,
  verify,
};
