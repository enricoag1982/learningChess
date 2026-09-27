import type { SelectSquaresDef } from '@chess-kids/core';
import type { ExerciseKindContent } from '../kind-content.ts';
import { compile } from './compile.ts';
import { refine, schema } from './schema.ts';
import { verify } from './verify.ts';

export const selectSquares: ExerciseKindContent<SelectSquaresDef, typeof schema> = {
  type: 'select-squares',
  schema,
  refine,
  compile,
  verify,
  /**
   * Explicit `squares` answer: a board-geometry question (e.g. "tap every light square in the
   * bottom row"), where a piece would only distract. `derive`d answers still need a kid piece.
   */
  needsKidPiece(def: SelectSquaresDef): boolean {
    return !('squares' in def.answer);
  },
};
