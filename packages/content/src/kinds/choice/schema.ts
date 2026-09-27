import { z } from 'zod';
import { keySchema } from '../../schema.ts';
import { exerciseCommonFields, textRefSchema } from '../common.ts';

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

export type ChoiceOptionYaml = z.infer<typeof choiceOptionSchema>;

/** Pick the correct option (e.g. "which piece is worth more?"). */
export const schema = z
  .object({
    ...exerciseCommonFields,
    type: z.literal('choice'),
    options: z.array(choiceOptionSchema).min(2),
    answer: z.string(),
    /** Hides the board (default: shown). Named apart from `board`, the position diagram field. */
    showBoard: z.boolean().optional(),
    /**
     * Load-time-only check (M3.1 `higher-value`; M3.2b `worth <n>` / `trade <SAN>`): `higher-value`
     * requires every option to be a piece and `answer` to be the (unique) higher-value one;
     * `worth <n>` requires every option to be a piece and `answer` to be the (unique) option worth
     * exactly `<n>`; `trade <SAN>` requires options ids `good`/`equal`/`bad` and `answer` to match
     * the loader's classification of the kid capture `<SAN>` in the position; `draw-kind` (M4.1)
     * requires options ids `stalemate`/`insufficient-material`/`not-a-draw` and `answer` to match
     * the loader's classification of the position. Never compiled into the runtime `ExerciseDef`.
     */
    verify: z
      .string()
      .regex(/^higher-value$|^worth [0-9]+$|^trade \S+$|^draw-kind$/)
      .optional(),
  })
  .strict();

/** Every option id unique, and `answer` references one of `options`. */
export function refine(value: z.output<typeof schema>, ctx: z.RefinementCtx): void {
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
