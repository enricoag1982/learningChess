import { PIECE_BY_LETTER, type ChoiceDef, type ChoiceOption, type Piece } from '@chess-kids/core';
import type { z } from 'zod';
import type { CompileContext } from '../kind-content.ts';
import type { ChoiceOptionYaml, schema } from './schema.ts';
import { checkChoiceVerify } from './verify.ts';

/** FEN letter → `Piece`; `choiceOptionSchema` already restricts the alphabet to `PIECE_BY_LETTER`'s keys. */
function pieceFromLetter(letter: string): Piece {
  const piece = PIECE_BY_LETTER[letter];
  if (piece === undefined) {
    throw new Error(`lesson-load: pieceFromLetter: invalid letter "${letter}"`);
  }
  return piece;
}

function compileChoiceOption(raw: ChoiceOptionYaml): ChoiceOption {
  return {
    id: raw.id,
    ...(raw.text === undefined ? {} : { textKey: `lessons:${raw.text}` }),
    ...(raw.piece === undefined ? {} : { piece: pieceFromLetter(raw.piece) }),
  };
}

export function compile(raw: z.output<typeof schema>, ctx: CompileContext): ChoiceDef {
  const exercise: ChoiceDef = ctx.build({
    type: 'choice',
    options: raw.options.map(compileChoiceOption),
    answer: raw.answer,
    showBoard: raw.showBoard ?? true,
  });
  checkChoiceVerify(exercise, raw.verify, ctx.where, ctx.issues);
  return exercise;
}
