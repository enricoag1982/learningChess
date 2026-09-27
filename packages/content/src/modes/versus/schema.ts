import { z } from 'zod';
import { checkExactlyOnePosition, positionFields, squareSchema } from '../../kinds/common.ts';
import { miniGameCommonFields } from '../common.ts';

/** FEN letter of a non-king piece type, for a `capture` win condition (`p`, `n`, `b`, `r`, `q`). */
const NON_KING_PIECE_PATTERN = /^[pnbrq]$/;

/** One side's win condition, as authored: the parameterless kinds are a bare string, the
 * parameterised ones a single-key object. Compiled to a `WinCondition` by `compile.ts`. */
const winConditionSchema = z.union([
  z.literal('checkmate'),
  z.literal('promote'),
  z.literal('capture-all'),
  z.object({ capture: z.string().regex(NON_KING_PIECE_PATTERN) }).strict(),
  z.object({ reach: z.array(squareSchema).min(1) }).strict(),
  z.object({ survive: z.number().int().positive() }).strict(),
]);

export type WinConditionYaml = z.infer<typeof winConditionSchema>;

/** A `versus` mini-game's rules (Pawn Wars, …): variant game rules plus which win conditions belong
 * to the kid vs. the opponent. `checkRules` is not authored: derived from `kings`. */
const versusRulesSchema = z
  .object({
    kings: z.boolean(),
    noMoves: z.enum(['lose', 'draw']),
    win: z
      .object({
        kid: z.array(winConditionSchema).min(1),
        opponent: z.array(winConditionSchema).min(1),
      })
      .strict(),
  })
  .strict();

/** A `versus` mini-game: variant rules played against the computer opponent, not a static or
 * scripted one. `kidColor` defaults to `w`; `par` is the kid-move threshold for 3 stars. */
export const schema = z
  .object({
    ...miniGameCommonFields,
    mode: z.literal('versus'),
    ...positionFields,
    rules: versusRulesSchema,
    opponent: z.object({ bot: z.number().int().min(1).max(5) }).strict(),
    kidColor: z.enum(['w', 'b']).optional(),
    par: z.number().int().positive().optional(),
    moveLimit: z.number().int().positive().optional(),
  })
  .strict()
  .superRefine(checkExactlyOnePosition);
