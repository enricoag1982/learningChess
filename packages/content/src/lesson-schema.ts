import { z } from 'zod';
import { keySchema } from './schema.ts';

/** Algebraic square, e.g. `e4`. */
const SQUARE_PATTERN = /^[a-h][1-8]$/;
export const squareSchema = z.string().regex(SQUARE_PATTERN);

/**
 * Locale key reference: one or more kebab-case segments joined by dots, e.g. `rook-01` or
 * `rook.story`. Compiles to `lessons:<value>` (or `characters:<value>` for character names).
 */
const TEXT_REF_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*(\.[a-z0-9]+(-[a-z0-9]+)*)*$/;
export const textRefSchema = z.string().regex(TEXT_REF_PATTERN);

/** Fields shared by anything authored as a board diagram or FEN (see `parseDiagram` / `parseFen`). */
const positionFields = {
  board: z.string().optional(),
  fen: z.string().optional(),
  toMove: z.enum(['w', 'b']).optional(),
};

/** Cross-field check shared by every schema with `positionFields`: exactly one of `board` / `fen`. */
function checkExactlyOnePosition(
  value: { readonly board?: string; readonly fen?: string },
  ctx: z.RefinementCtx,
): void {
  if ((value.board !== undefined) === (value.fen !== undefined)) {
    ctx.addIssue({ code: 'custom', message: 'exactly one of "board" or "fen" is required' });
  }
}

/** A lesson's demo: position, spoken text, and the square whose legal moves are highlighted. */
export const demoSchema = z
  .object({
    ...positionFields,
    text: textRefSchema,
    highlight: z.string().regex(/^legal-moves [a-h][1-8]$/),
  })
  .strict()
  .superRefine(checkExactlyOnePosition);

const exerciseCommonFields = {
  id: keySchema,
  text: textRefSchema,
  easier: keySchema.optional(),
  ...positionFields,
};

const collectStarsSchema = z
  .object({
    ...exerciseCommonFields,
    type: z.literal('collect-stars'),
    stars3: z.number().int().positive(),
    stars2: z.number().int().positive(),
  })
  .strict();

const captureSchema = z
  .object({
    ...exerciseCommonFields,
    type: z.literal('capture'),
    stars3: z.number().int().positive(),
    stars2: z.number().int().positive(),
  })
  .strict();

const selectSquaresSchema = z
  .object({
    ...exerciseCommonFields,
    type: z.literal('select-squares'),
    answer: z.array(squareSchema).optional(),
    derive: z.literal('legal-moves').optional(),
    from: squareSchema.optional(),
  })
  .strict();

const yesNoSchema = z
  .object({
    ...exerciseCommonFields,
    type: z.literal('yes-no'),
    answer: z.enum(['yes', 'no']),
    focus: squareSchema.optional(),
  })
  .strict();

/** FEN letter of a piece, either colour (`K`, `q`, …). */
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

const choiceSchema = z
  .object({
    ...exerciseCommonFields,
    type: z.literal('choice'),
    options: z.array(choiceOptionSchema).min(2),
    answer: z.string(),
    /** Hides the board (default: shown). Named apart from `board`, the position diagram field. */
    showBoard: z.boolean().optional(),
  })
  .strict();

const bestMoveSchema = z
  .object({
    ...exerciseCommonFields,
    type: z.literal('best-move'),
    solutions: z.array(z.string()).min(1),
  })
  .strict();

/** A setup exercise's goal position: same shape as `positionFields`, minus `toMove` (unused). */
const targetSchema = z
  .object({ board: z.string().optional(), fen: z.string().optional() })
  .strict()
  .superRefine(checkExactlyOnePosition);

const setupSchema = z
  .object({
    ...exerciseCommonFields,
    type: z.literal('setup'),
    target: targetSchema,
  })
  .strict();

/** One exercise (`guided` or `exercises` entry), discriminated by `type`. */
export const exerciseSchema = z
  .discriminatedUnion('type', [
    collectStarsSchema,
    captureSchema,
    selectSquaresSchema,
    yesNoSchema,
    choiceSchema,
    bestMoveSchema,
    setupSchema,
  ])
  .superRefine((value, ctx) => {
    checkExactlyOnePosition(value, ctx);
    if (value.type === 'select-squares') {
      const hasAnswer = value.answer !== undefined;
      const hasDerive = value.derive !== undefined || value.from !== undefined;
      if (hasAnswer === hasDerive) {
        ctx.addIssue({
          code: 'custom',
          message: 'exactly one of "answer" or "derive" + "from" is required',
        });
        return;
      }
      if (hasDerive && (value.derive === undefined || value.from === undefined)) {
        ctx.addIssue({ code: 'custom', message: '"derive" requires both "derive" and "from"' });
      }
      if (hasAnswer && value.answer?.length === 0) {
        ctx.addIssue({ code: 'custom', path: ['answer'], message: '"answer" must not be empty' });
      }
    }
    if (value.type === 'choice') {
      const ids = value.options.map((option) => option.id);
      const seen = new Set<string>();
      for (const id of ids) {
        if (seen.has(id)) {
          ctx.addIssue({
            code: 'custom',
            path: ['options'],
            message: `duplicate option id "${id}"`,
          });
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
  });

export type ExerciseYaml = z.infer<typeof exerciseSchema>;
export type ChoiceOptionYaml = z.infer<typeof choiceOptionSchema>;

/** One lesson file (`lessons/<world>/<lesson-id>.yaml`). */
export const lessonSchema = z
  .object({
    id: keySchema,
    world: keySchema,
    order: z.number().int().positive(),
    concept: keySchema,
    character: keySchema,
    title: textRefSchema,
    story: textRefSchema,
    demo: demoSchema,
    guided: z.array(exerciseSchema),
    exercises: z.array(exerciseSchema).min(1),
    boss: keySchema.optional(),
  })
  .strict();

export type LessonYaml = z.infer<typeof lessonSchema>;

/** One mini-game file (`minigames/<id>.yaml`); static capture only in M1. */
export const miniGameSchema = z
  .object({
    id: keySchema,
    concept: keySchema,
    unlockAfter: keySchema,
    title: textRefSchema,
    goal: textRefSchema,
    ...positionFields,
    par: z.number().int().positive(),
    moveLimit: z.number().int().positive(),
  })
  .strict()
  .superRefine(checkExactlyOnePosition);

export type MiniGameYaml = z.infer<typeof miniGameSchema>;
