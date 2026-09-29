import type { TextKeyRef } from '@learn/platform-core';
import { PIECE_BY_LETTER } from '../../core/chess/notation.ts';
import type { ChoiceDef, ChoiceOption } from '../../core/exercise/types.ts';
import type { Piece } from '../../core/chess/types.ts';
import { z } from 'zod';
import { keySchema } from '@learn/platform-content/schema';
import { exerciseCommonFields, textRefSchema } from '../../content/kinds/common.ts';
import type { ExerciseKindContent } from '@learn/platform-content/kinds/kind-content';
import type { CompileContext } from '@learn/platform-content/kinds/kind-content';
import { checkChoiceVerify } from './verify.ts';

const FEN_PIECE_PATTERN = /^[KQRBNPkqrbnp]$/;

const choiceOptionSchema = z
  .object({
    id: keySchema,
    text: textRefSchema.optional(),
    piece: z.string().regex(FEN_PIECE_PATTERN).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.text === undefined && value.piece === undefined) {
      ctx.addIssue({ code: 'custom', message: 'option needs "text" or "piece"' });
    }
  });

export type ChoiceOptionYaml = z.infer<typeof choiceOptionSchema>;

export const schema = z
  .object({
    ...exerciseCommonFields,
    type: z.literal('choice'),
    options: z.array(choiceOptionSchema).min(2),
    answer: z.string(),
    /** Hides the board (default: shown). Named apart from `board`, the position diagram field. */
    showBoard: z.boolean().optional(),
    /** Load-time-only check; see `verify.ts` for each rule's meaning. Never compiled into the
     * runtime `ExerciseDef`. */
    verify: z
      .string()
      .regex(/^higher-value$|^worth [0-9]+$|^trade \S+$|^draw-kind$/)
      .optional(),
  })
  .strict();

function refine(value: z.output<typeof schema>, ctx: z.RefinementCtx): void {
  const ids = value.options.map((option) => option.id);
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      ctx.addIssue({ code: 'custom', path: ['options'], message: `duplicate option id "${id}"` });
    }
    seen.add(id);
  }
  if (!ids.includes(value.answer)) {
    ctx.addIssue({
      code: 'custom',
      path: ['answer'],
      message: '"answer" must reference one of "options"',
    });
  }
}

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

function compile(raw: z.output<typeof schema>, ctx: CompileContext): ChoiceDef {
  const exercise: ChoiceDef = ctx.build({
    type: 'choice',
    options: raw.options.map(compileChoiceOption),
    answer: raw.answer,
    showBoard: raw.showBoard ?? true,
  });
  checkChoiceVerify(exercise, raw.verify, ctx.where, ctx.issues);
  return exercise;
}

function textKeys(def: ChoiceDef): readonly TextKeyRef[] {
  return def.options
    .filter(
      (option): option is ChoiceOption & { readonly textKey: string } =>
        option.textKey !== undefined,
    )
    .map((option) => ({ key: option.textKey, label: `option "${option.id}"` }));
}

// No semantic `verify`: option-id uniqueness, answer membership and "text or piece" are all
// schema-level; the authored `verify` field itself is checked at compile time (`checkChoiceVerify`).
export const choice: ExerciseKindContent<ChoiceDef, typeof schema> = {
  type: 'choice',
  schema,
  refine,
  compile,
  textKeys,
};
