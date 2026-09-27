/**
 * Fields, cross-field checks and small helpers shared by every exercise kind's schema
 * (`kinds/<type>/schema.ts`) and compile/verify logic.
 */
import { chessJsRules, createVariantRules } from '@chess-kids/core';
import { z } from 'zod';
import { keySchema } from '../schema.ts';

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
export const positionFields = {
  board: z.string().optional(),
  fen: z.string().optional(),
  toMove: z.enum(['w', 'b']).optional(),
};

/** Cross-field check shared by every schema with `positionFields`: exactly one of `board` / `fen`. */
export function checkExactlyOnePosition(
  value: { readonly board?: string; readonly fen?: string },
  ctx: z.RefinementCtx,
): void {
  if ((value.board !== undefined) === (value.fen !== undefined)) {
    ctx.addIssue({ code: 'custom', message: 'exactly one of "board" or "fen" is required' });
  }
}

/** Fields every exercise type shares (`lesson-schema.ts`'s exercise union member). */
export const exerciseCommonFields = {
  id: keySchema,
  text: textRefSchema,
  easier: keySchema.optional(),
  /**
   * The opponent's last move, `<from><to>` (e.g. `d7d5`), display only (M4.1): the loader checks a
   * piece sits on `to`, and — when the position has an en passant square — that this is exactly the
   * double step that produced it. See `ExerciseBase.lastMove` (`@chess-kids/core`).
   */
  lastMove: z
    .string()
    .regex(/^[a-h][1-8][a-h][1-8]$/)
    .optional(),
  ...positionFields,
};

/** Shared standard-rules instance for load-time legality / solvability checks (no fakes needed). */
export const rules = createVariantRules(chessJsRules);

/**
 * Classifies a kid capture (M3.2b `docs/curriculum.md` World 3 "Trades"): `good` when the captured
 * piece is worth more than the capturer or is undefended (a free or winning capture either way),
 * `equal` when same value and defended, `bad` when worth less than the capturer and defended (a
 * losing trade even though it looks like "getting" a piece). Shared by `choice`'s `trade <SAN>`
 * verify and `best-move`'s `good-trade` verify.
 */
export function classifyTrade(
  capturedValue: number,
  capturerValue: number,
  defended: boolean,
): 'good' | 'equal' | 'bad' {
  if (!defended || capturedValue > capturerValue) return 'good';
  if (capturedValue === capturerValue) return 'equal';
  return 'bad';
}
