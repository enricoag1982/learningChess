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

// Published counts: https://www.chessprogramming.org/Perft_Results
describe('perft', () => {
  it.each([
    ['start', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 3, 8902],
    ['kiwipete', 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', 2, 2039],
    ['position 3', '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', 3, 2812],
    ['position 4', 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', 2, 264],
    ['position 5', 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', 2, 1486],
  ])('%s depth %i = %i', (_name, fen, depth, expected) => {
    expect(perft(parseFen(fen), depth)).toBe(expected);
  });
});

/** Same leaf count as `perft`, but through one reused `SearchBoard` (play/undo) instead of `play`. */
function perftViaSearchBoard(position: Position, depth: number): number {
  const board = rules.searchBoard(position);
  function walk(remaining: number): number {
    const moves = board.moves();
    if (remaining === 1) return moves.length;
    let nodes = 0;
    for (const move of moves) {
      board.play(move);
      nodes += walk(remaining - 1);
      board.undo();
    }
    return nodes;
  }
  return walk(depth);
}

describe('perft via searchBoard', () => {
  it.each([
    ['start', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 3, 8902],
    ['kiwipete', 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', 2, 2039],
  ])('%s depth %i = %i', (_name, fen, depth, expected) => {
    expect(perftViaSearchBoard(parseFen(fen), depth)).toBe(expected);
  });
});
