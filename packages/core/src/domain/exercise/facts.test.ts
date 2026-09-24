import { describe, expect, it } from 'vitest';

import { chessJsRules } from '../chess/chessjs-rules.ts';
import { parseFen } from '../chess/fen.ts';
import {
  canCastle,
  canEnPassant,
  isAttacked,
  isCheckmate,
  isDefended,
  isHanging,
  isInCheck,
  isInsufficientMaterial,
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

describe('isInsufficientMaterial', () => {
  it('a lone king vs. a lone king is insufficient material', () => {
    const position = parseFen('4k3/8/8/8/8/8/8/4K3 w - - 0 1');
    expect(isInsufficientMaterial(position, rules)).toBe(true);
  });

  it('a king and rook vs. a lone king is sufficient material', () => {
    const position = parseFen('4k3/8/8/8/8/8/8/3RK3 w - - 0 1');
    expect(isInsufficientMaterial(position, rules)).toBe(false);
  });
});

describe('canCastle', () => {
  // White king e1, rooks a1/h1, both castling rights, black king far away: both directions legal.
  const bothSides = parseFen('4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1');

  it('true for kingside when the right is present and the path is clear and unattacked', () => {
    expect(canCastle(bothSides, 'kingside', rules)).toBe(true);
  });

  it('true for queenside when the right is present and the path is clear and unattacked', () => {
    expect(canCastle(bothSides, 'queenside', rules)).toBe(true);
  });

  it('false for either side once the castling right is gone (king/rook already moved)', () => {
    const noRights = parseFen('4k3/8/8/8/8/8/8/R3K2R w - - 0 1');
    expect(canCastle(noRights, 'kingside', rules)).toBe(false);
    expect(canCastle(noRights, 'queenside', rules)).toBe(false);
  });

  it('false when the king is in check', () => {
    const inCheck = parseFen('4k3/8/8/8/8/8/4r3/R3K2R w KQ - 0 1');
    expect(canCastle(inCheck, 'kingside', rules)).toBe(false);
  });

  it('false when a square in the path is occupied', () => {
    const blocked = parseFen('4k3/8/8/8/8/8/8/R3KB1R w KQ - 0 1'); // bishop on f1 blocks O-O
    expect(canCastle(blocked, 'kingside', rules)).toBe(false);
  });

  it('false when the king would cross or land on an attacked square', () => {
    // Black rook on f8 covers f1, the square the king must cross for O-O.
    const attacked = parseFen('5rk1/8/8/8/8/8/8/R3K2R w KQ - 0 1');
    expect(canCastle(attacked, 'kingside', rules)).toBe(false);
  });
});

describe('canEnPassant', () => {
  // Black just played d7-d5; the white pawn on e5 may capture it en passant on d6.
  const justDoubleStepped = parseFen('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1');

  it('true right after the double step, with a capturing pawn in place', () => {
    expect(canEnPassant(justDoubleStepped, rules)).toBe(true);
  });

  it('false once the en passant square is no longer set (double step was not the last move)', () => {
    const noEpRights = parseFen('4k3/8/8/3pP3/8/8/8/4K3 w - - 0 1');
    expect(canEnPassant(noEpRights, rules)).toBe(false);
  });

  it('false with no pawn able to capture on the en passant square', () => {
    const noCapturer = parseFen('4k3/8/8/3p4/8/8/8/4K3 w - d6 0 1');
    expect(canEnPassant(noCapturer, rules)).toBe(false);
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
