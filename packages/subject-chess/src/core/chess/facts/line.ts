import type { ChessRules, Move } from '../rules.ts';
import type { Position } from '../types.ts';

/** A SAN line replayed to its end: the position after each move, and the moves themselves. */
export interface ReplayedLine {
  readonly positions: readonly Position[];
  readonly moves: readonly Move[];
}

/** A SAN line that could not be replayed past `sans[failedAt]` (not a legal move there). */
export interface FailedReplay {
  readonly failedAt: number;
}

export type ReplayResult = ReplayedLine | FailedReplay;

/** Plays `sans` in order from `position` under real chess rules, or stops at the first illegal one. */
export function replaySanLine(
  position: Position,
  sans: readonly string[],
  rules: ChessRules,
): ReplayResult {
  const positions: Position[] = [];
  const moves: Move[] = [];
  let current = position;
  for (const [index, san] of sans.entries()) {
    const played = rules.play(current, san);
    if (played === null) {
      return { failedAt: index };
    }
    current = played.position;
    positions.push(current);
    moves.push(played.move);
  }
  return { positions, moves };
}
