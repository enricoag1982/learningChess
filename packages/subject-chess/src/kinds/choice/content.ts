import { createChoiceContent } from '@learn/platform-content/kinds/choice';
import { z } from 'zod';
import { PIECE_BY_LETTER } from '../../core/chess/notation.ts';
import type { Piece } from '../../core/chess/types.ts';
import type { ChoiceDef } from '../../core/exercise/types.ts';
import { exerciseCommonFields } from '../../content/kinds/common.ts';
import { checkChoiceVerify } from './verify.ts';

const FEN_PIECE_PATTERN = /^[KQRBNPkqrbnp]$/;

const fields = {
  ...exerciseCommonFields,
  /** Hides the board (default: shown). Named apart from `board`, the position diagram field. */
  showBoard: z.boolean().optional(),
  /** Load-time-only check; see `verify.ts` for each rule's meaning. Never compiled into the
   * runtime `ExerciseDef`. */
  verify: z
    .string()
    .regex(/^higher-value$|^worth [0-9]+$|^trade \S+$|^draw-kind$/)
    .optional(),
};

const optionFields = { piece: z.string().regex(FEN_PIECE_PATTERN).optional() };

function pieceFromLetter(letter: string): Piece {
  const piece = PIECE_BY_LETTER[letter];
  if (piece === undefined) {
    throw new Error(`lesson-load: pieceFromLetter: invalid letter "${letter}"`);
  }
  return piece;
}

// No semantic `verify`: option-id uniqueness, answer membership and "text or piece" are all
// schema-level; the authored `verify` field itself is checked at compile time (`checkChoiceVerify`).
export const choice = createChoiceContent<ChoiceDef, typeof fields, typeof optionFields>({
  fields,
  option: {
    fields: optionFields,
    refine(raw, ctx) {
      if (raw.text === undefined && raw.piece === undefined) {
        ctx.addIssue({ code: 'custom', message: 'option needs "text" or "piece"' });
      }
    },
    compile: (raw) => (raw.piece === undefined ? {} : { piece: pieceFromLetter(raw.piece) }),
  },
  body: (raw) => ({ showBoard: raw.showBoard ?? true }),
  check: (def, raw, ctx) => {
    checkChoiceVerify(def, raw.verify, ctx.where, ctx.issues);
  },
});
