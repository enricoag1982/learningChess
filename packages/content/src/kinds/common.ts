// Fields, cross-field checks and small helpers shared by every exercise kind's schema and
// compile/verify logic.
import {
  chessJsRules,
  createVariantRules,
  DiagramError,
  FenError,
  optimalMoves,
  parseDiagram,
  parseFen,
  type CaptureDef,
  type CollectStarsDef,
  type Position,
} from '@chess-kids/core';
import { z } from 'zod';
import { keySchema } from '../schema.ts';

/** Algebraic square, e.g. `e4`. */
const SQUARE_PATTERN = /^[a-h][1-8]$/;
export const squareSchema = z.string().regex(SQUARE_PATTERN);

/** Locale key reference: one or more kebab-case segments joined by dots, e.g. `rook-01` or
 * `rook.story`. Compiles to `lessons:<value>` (or `characters:<value>` for character names). */
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
  /** The opponent's last move, `<from><to>` (e.g. `d7d5`), display only: the loader checks a piece
   * sits on `to`, and, with an en passant square, that this is the double step that produced it. */
  lastMove: z
    .string()
    .regex(/^[a-h][1-8][a-h][1-8]$/)
    .optional(),
  ...positionFields,
};

/** Shared standard-rules instance for load-time legality / solvability checks (no fakes needed). */
export const rules = createVariantRules(chessJsRules);

/** Fields shared by anything authored as a board diagram or FEN (see `parseDiagram` / `parseFen`). */
export interface PositionYaml {
  readonly board?: string;
  readonly fen?: string;
  readonly toMove?: 'w' | 'b';
}

/** Parses a board diagram or FEN into a `Position`, reporting `DiagramError` / `FenError` as an issue. */
export function compilePosition(
  relPath: string,
  fieldPath: string,
  raw: PositionYaml,
  issues: string[],
): Position | null {
  try {
    if (raw.board !== undefined) {
      return parseDiagram(raw.board, { toMove: raw.toMove });
    }
    return parseFen(raw.fen ?? '');
  } catch (error) {
    if (error instanceof DiagramError || error instanceof FenError) {
      issues.push(`${relPath}: ${fieldPath}: ${error.message}`);
      return null;
    }
    throw error;
  }
}

/** Classifies a kid capture: `good` when the captured piece is worth more or is undefended, `equal`
 * when same value and defended, `bad` when worth less and defended. */
export function classifyTrade(
  capturedValue: number,
  capturerValue: number,
  defended: boolean,
): 'good' | 'equal' | 'bad' {
  if (!defended || capturedValue > capturerValue) return 'good';
  if (capturedValue === capturerValue) return 'equal';
  return 'bad';
}

/** `collect-stars` / `capture` shared semantic check: `stars3` must equal the solver's optimal move
 * count, and `stars2` must be at least `stars3`. */
export function checkOptimalMoves(
  exercise: CaptureDef | CollectStarsDef,
  where: string,
  issues: string[],
): void {
  const optimal = optimalMoves(exercise, rules);
  if (optimal === null) {
    issues.push(`${where}: no solution found (not solvable within the search depth)`);
    return;
  }
  if (optimal !== exercise.stars3) {
    issues.push(
      `${where}: stars3 is ${String(exercise.stars3)} but the optimal solve is ${String(optimal)} move(s)`,
    );
  }
  if (exercise.stars2 < exercise.stars3) {
    issues.push(
      `${where}: stars2 (${String(exercise.stars2)}) is below stars3 (${String(exercise.stars3)})`,
    );
  }
}
