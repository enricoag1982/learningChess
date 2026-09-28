import { describe, expect, it } from 'vitest';

import { chessJsRules as rules } from './chessjs-rules.ts';
import { parseFen } from './fen.ts';
import type { Position } from './types.ts';

/** Leaf node count of the legal move tree, through the public `ChessRules` API only. */
function perft(position: Position, depth: number): number {
  const moves = rules.legalMoves(position);
  if (depth === 1) return moves.length;
  let nodes = 0;
  for (const move of moves) {
    const next = rules.play(position, {
      from: move.from,
      to: move.to,
      ...(move.promotion === undefined ? {} : { promotion: move.promotion }),
    });
    if (next === null) throw new Error(`legal move rejected: ${move.san}`);
    nodes += perft(next.position, depth - 1);
  }
  return nodes;
}

// Depth 3 from the start position (8902 leaf nodes, ≈ 0.5-0.6s — the one `perft.test.ts` case over
// the m8.2 item 1 "> 0.5s" threshold) moved here; every other depth (all under it) stays in
// `perft.test.ts`. Published counts: https://www.chessprogramming.org/Perft_Results
describe('perft', () => {
  it.each([['start', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 3, 8902]])(
    '%s depth %i = %i',
    (_name, fen, depth, expected) => {
      expect(perft(parseFen(fen), depth)).toBe(expected);
    },
  );
});
