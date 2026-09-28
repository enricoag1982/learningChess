import {
  chessJsRules,
  hasKing,
  isCheckmate,
  isStalemate,
  replaySanLine,
  type MateInNDef,
} from '@chess-kids/core/chess';
import { z } from 'zod';
import { exerciseCommonFields, rules } from '../common.ts';
import type { ExerciseKindContent } from '../kind-content.ts';
import type { CompileContext } from '../kind-content.ts';

/**
 * Deliver checkmate under real chess rules (both kings, real turn alternation): `line` is the full
 * scripted sequence in SAN — kid move, opponent reply, kid move, …, final kid move (which mates).
 */
export const schema = z
  .object({
    ...exerciseCommonFields,
    type: z.literal('mate-in-n'),
    n: z.number().int().positive(),
    line: z.array(z.string()).min(1),
    /** "Don't stalemate" exercises: the loader requires >= 1 legal kid move besides the scripted
     * line that would stalemate the opponent. Load-time only. */
    trap: z.literal('stalemate').optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const expected = 2 * value.n - 1;
    if (value.line.length !== expected) {
      ctx.addIssue({
        code: 'custom',
        path: ['line'],
        message: `"line" must have exactly 2*n-1 = ${String(expected)} moves for n=${String(value.n)}`,
      });
    }
  });

/** A `mate-in-n` exercise's optional `trap: stalemate`: requires at least one legal kid move, at
 * the start position, that stalemates the opponent instead of the scripted mating line. */
function checkMateInNTrap(
  exercise: MateInNDef,
  trap: 'stalemate' | undefined,
  where: string,
  issues: string[],
): void {
  if (trap === undefined) {
    return;
  }
  const candidates = rules.legalMoves(exercise.position, { staticOpponent: true });
  const hasStalemateTrap = candidates.some((move) => {
    const played = chessJsRules.play(exercise.position, {
      from: move.from,
      to: move.to,
      ...(move.promotion === undefined ? {} : { promotion: move.promotion }),
    });
    return played !== null && isStalemate(played.position, chessJsRules);
  });
  if (!hasStalemateTrap) {
    issues.push(
      `${where}: trap "stalemate" requires >= 1 legal kid move (besides the scripted line) that stalemates the opponent`,
    );
  }
}

function compile(raw: z.output<typeof schema>, ctx: CompileContext): MateInNDef {
  const exercise: MateInNDef = ctx.build({ type: 'mate-in-n', n: raw.n, line: raw.line });
  checkMateInNTrap(exercise, raw.trap, ctx.where, ctx.issues);
  return exercise;
}

/** `mate-in-n`: both kings on the board, every line entry a legal move played in sequence under
 * real chess rules, and the final kid move delivers checkmate. */
function verify(exercise: MateInNDef, where: string, issues: string[]): void {
  if (!hasKing(exercise.position, 'w') || !hasKing(exercise.position, 'b')) {
    issues.push(`${where}: mate-in-n requires both kings on the board`);
    return;
  }
  const replayed = replaySanLine(exercise.position, exercise.line, chessJsRules);
  if ('failedAt' in replayed) {
    const san = exercise.line[replayed.failedAt];
    issues.push(
      `${where}: line[${String(replayed.failedAt)}] "${String(san)}" is not a legal move`,
    );
    return;
  }
  const finalPosition = replayed.positions[replayed.positions.length - 1];
  if (finalPosition === undefined || !isCheckmate(finalPosition, chessJsRules)) {
    issues.push(`${where}: the final move in "line" does not deliver checkmate`);
  }
}

export const mateInN: ExerciseKindContent<MateInNDef, typeof schema> = {
  type: 'mate-in-n',
  schema,
  compile,
  verify,
};
