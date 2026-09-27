import {
  chessJsRules,
  hasKing,
  isCheckmate,
  isStalemate,
  replaySanLine,
  type MateInNDef,
} from '@chess-kids/core';
import { rules } from '../common.ts';

/**
 * A `mate-in-n` exercise's optional `trap: stalemate` (M3.3 "don't stalemate"): requires at least
 * one legal kid move, at the exercise's own start position, that stalemates the opponent instead
 * of the scripted mating line — a mistake the exercise is meant to teach avoiding. Real rules (both
 * kings, real turn alternation), like every other mate-in-n check; never compiled into the runtime
 * `MateInNDef`.
 */
export function checkMateInNTrap(
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

/**
 * `mate-in-n`: both kings on the board, every line entry a legal move played in sequence under real
 * chess rules (turns alternate normally, never a static opponent), and the final (`n`th) kid move
 * delivers checkmate. `n` matching `line.length` is already schema-enforced.
 */
export function verify(exercise: MateInNDef, where: string, issues: string[]): void {
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
