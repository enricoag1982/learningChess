import { describe, expect, it } from 'vitest';

import { chessJsRules } from '../chess/chessjs-rules.ts';
import { parseFen } from '../chess/fen.ts';
import {
  isAttacked,
  isCheckmate,
  isDefended,
  isHanging,
  isInCheck,
  isSafe,
  isStalemate,
  kingSquare,
  pieceValue,
} from './facts.ts';

const rules = chessJsRules;

describe('kingSquare', () => {
  const position = parseFen('6k1/8/8/8/8/8/8/4K3 w - - 0 1');

  it("finds each side's king", () => {
    expect(kingSquare(position, 'w')).toBe('e1');
    expect(kingSquare(position, 'b')).toBe('g8');
  });

  it('is undefined when that side has no king', () => {
    const noBlackKing = parseFen('8/8/8/8/8/8/8/4K3 w - - 0 1');
    expect(kingSquare(noBlackKing, 'b')).toBeUndefined();
  });
});

describe('isAttacked / isDefended / isHanging', () => {
  // White queen on d5 (undefended, attacked by the black rook on d8); white knight on b5
  // (defended by the white pawn on a4); white king e1, black king g8.
  const position = parseFen('3r2k1/8/8/1N1Q4/P7/8/8/4K3 w - - 0 1');

  it('a piece with an enemy attacker on its line is attacked', () => {
    expect(isAttacked(position, 'd5', rules)).toBe(true);
  });

  it('a piece with no enemy attacker is not attacked', () => {
    expect(isAttacked(position, 'b5', rules)).toBe(false);
  });

  it('an empty square attacked by the side not to move is attacked', () => {
    expect(isAttacked(position, 'd7', rules)).toBe(true); // rook d8 covers the d-file
  });

  it('a piece defended by its own side is defended', () => {
    expect(isDefended(position, 'b5', rules)).toBe(true); // pawn a4 defends b5
  });

  it('a piece with no defender is not defended', () => {
    expect(isDefended(position, 'd5', rules)).toBe(false);
  });

  it('an empty square is never defended', () => {
    expect(isDefended(position, 'd7', rules)).toBe(false);
  });

  it('attacked and undefended is hanging', () => {
    expect(isHanging(position, 'd5', rules)).toBe(true);
  });

  it('attacked but defended is not hanging', () => {
    expect(isHanging(position, 'b5', rules)).toBe(false);
  });

  it('an empty square is never hanging', () => {
    expect(isHanging(position, 'a1', rules)).toBe(false);
  });
});

describe('pieceValue', () => {
  it('reports the standard values: P1 N3 B3 R5 Q9', () => {
    expect(pieceValue('p')).toBe(1);
    expect(pieceValue('n')).toBe(3);
    expect(pieceValue('b')).toBe(3);
    expect(pieceValue('r')).toBe(5);
    expect(pieceValue('q')).toBe(9);
  });

  it('reports 0 for the king (no trade value)', () => {
    expect(pieceValue('k')).toBe(0);
  });
});

describe('isSafe', () => {
  it('a piece with no attacker is safe', () => {
    // White knight b5, nothing attacks it.
    const position = parseFen('4k3/8/8/1N6/8/8/8/4K3 w - - 0 1');
    expect(isSafe(position, 'b5', rules)).toBe(true);
  });

  it('a piece attacked only by an equal-or-higher-value piece and defended is safe', () => {
    // White knight d5 attacked by the black rook on d8, defended by the white pawn on e4.
    const position = parseFen('3r2k1/8/8/3N4/4P3/8/8/4K3 w - - 0 1');
    expect(isSafe(position, 'd5', rules)).toBe(true);
  });

  it('a piece attacked by a higher-value piece is still unsafe when undefended', () => {
    // White knight d5 attacked by the black queen on d8, nothing defends it: not a lower-value
    // attacker, but still attacked-and-undefended, so not safe either way.
    const position = parseFen('3q2k1/8/8/3N4/8/8/8/4K3 w - - 0 1');
    expect(isSafe(position, 'd5', rules)).toBe(false);
  });

  it('a piece attacked by a lower-value piece is unsafe even when defended', () => {
    // White knight d5 attacked by the black pawn on e6, defended by the white queen on d1: still a
    // bad trade for white (loses N3 to win P1), so not safe.
    const position = parseFen('6k1/8/4p3/3N4/8/8/8/3QK3 w - - 0 1');
    expect(isSafe(position, 'd5', rules)).toBe(false);
  });

  it('an attacked, undefended piece is unsafe', () => {
    const position = parseFen('3r2k1/8/8/3N4/8/8/8/4K3 w - - 0 1');
    expect(isSafe(position, 'd5', rules)).toBe(false);
  });

  it('an empty square is never safe', () => {
    const position = parseFen('4k3/8/8/8/8/8/8/4K3 w - - 0 1');
    expect(isSafe(position, 'd5', rules)).toBe(false);
  });
});

describe('isInCheck / isCheckmate / isStalemate', () => {
  it('true only for a position with the side to move in check', () => {
    const inCheck = parseFen('6k1/8/8/8/8/8/8/1Q2K3 w - - 0 1'); // not white's check to give here
    const checked = parseFen('6k1/5Q2/6K1/8/8/8/8/8 b - - 0 1'); // black king in check
    expect(isInCheck(inCheck, rules)).toBe(false);
    expect(isInCheck(checked, rules)).toBe(true);
  });

  it("recognises checkmate (fool's mate)", () => {
    const mated = parseFen('rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3');
    expect(isCheckmate(mated, rules)).toBe(true);
    expect(isInCheck(mated, rules)).toBe(true);
  });

  it('a check that is not mate is not checkmate', () => {
    const check = parseFen('6k1/5Q2/6K1/8/8/8/8/8 b - - 0 1');
    expect(isCheckmate(check, rules)).toBe(false);
  });

  it('recognises stalemate', () => {
    // Black king a8, no black moves, not in check: a textbook stalemate.
    const stalemated = parseFen('k7/2Q5/1K6/8/8/8/8/8 b - - 0 1');
    expect(isStalemate(stalemated, rules)).toBe(true);
    expect(isInCheck(stalemated, rules)).toBe(false);
  });

  it('a position with legal moves is not stalemate', () => {
    const playable = parseFen('6k1/8/8/8/8/8/8/4K3 w - - 0 1');
    expect(isStalemate(playable, rules)).toBe(false);
  });
});
