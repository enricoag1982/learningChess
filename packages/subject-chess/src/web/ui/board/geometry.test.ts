import { describe, expect, it } from 'vitest';
import type { Rect } from './geometry.ts';
import { cellToSquare, distance, squareAt, squareToCell } from './geometry.ts';

const RECT: Rect = { left: 100, top: 200, width: 800, height: 800 };
const CELL = 100; // RECT.width / 8

describe('squareToCell / cellToSquare', () => {
  it('places a8 top-left and h1 bottom-right for white orientation', () => {
    expect(squareToCell('a8', 'w')).toEqual({ row: 0, col: 0 });
    expect(squareToCell('h1', 'w')).toEqual({ row: 7, col: 7 });
    expect(squareToCell('e4', 'w')).toEqual({ row: 4, col: 4 });
  });

  it('places h1 top-left and a8 bottom-right for black orientation', () => {
    expect(squareToCell('h1', 'b')).toEqual({ row: 0, col: 0 });
    expect(squareToCell('a8', 'b')).toEqual({ row: 7, col: 7 });
  });

  it('cellToSquare is the inverse of squareToCell for both orientations', () => {
    for (const orientation of ['w', 'b'] as const) {
      for (let row = 0; row < 8; row += 1) {
        for (let col = 0; col < 8; col += 1) {
          const square = cellToSquare(row, col, orientation);
          expect(square).not.toBeNull();
          expect(squareToCell(square ?? 'a1', orientation)).toEqual({ row, col });
        }
      }
    }
  });

  it('returns null outside the 8x8 grid', () => {
    expect(cellToSquare(-1, 0, 'w')).toBeNull();
    expect(cellToSquare(0, -1, 'w')).toBeNull();
    expect(cellToSquare(8, 0, 'w')).toBeNull();
    expect(cellToSquare(0, 8, 'w')).toBeNull();
  });
});

describe('squareAt', () => {
  it('finds the square under a point for white orientation (a8 top-left)', () => {
    expect(squareAt({ x: RECT.left + 1, y: RECT.top + 1 }, RECT, 'w')).toBe('a8');
    expect(squareAt({ x: RECT.left + CELL * 4 + 10, y: RECT.top + CELL * 4 + 10 }, RECT, 'w')).toBe(
      'e4',
    );
  });

  it('finds the square under a point for black orientation (h1 top-left)', () => {
    expect(squareAt({ x: RECT.left + 1, y: RECT.top + 1 }, RECT, 'b')).toBe('h1');
    expect(squareAt({ x: RECT.left + CELL * 7 + 10, y: RECT.top + CELL * 7 + 10 }, RECT, 'b')).toBe(
      'a8',
    );
  });

  it('defaults to white orientation', () => {
    expect(squareAt({ x: RECT.left + 1, y: RECT.top + 1 }, RECT)).toBe('a8');
  });

  it('handles the exact right/bottom edge of a square (still inside the board)', () => {
    // Just inside the last column/row.
    expect(
      squareAt({ x: RECT.left + RECT.width - 1, y: RECT.top + RECT.height - 1 }, RECT, 'w'),
    ).toBe('h1');
    // A cell boundary belongs to the next cell (floor of the ratio).
    expect(squareAt({ x: RECT.left + CELL, y: RECT.top }, RECT, 'w')).toBe('b8');
  });

  it('returns null outside the board rect', () => {
    expect(squareAt({ x: RECT.left - 1, y: RECT.top + 10 }, RECT, 'w')).toBeNull();
    expect(squareAt({ x: RECT.left + 10, y: RECT.top - 1 }, RECT, 'w')).toBeNull();
    expect(squareAt({ x: RECT.left + RECT.width, y: RECT.top + 10 }, RECT, 'w')).toBeNull();
    expect(squareAt({ x: RECT.left + 10, y: RECT.top + RECT.height }, RECT, 'w')).toBeNull();
  });

  it('returns null for a zero-size rect', () => {
    expect(squareAt({ x: 0, y: 0 }, { left: 0, top: 0, width: 0, height: 0 }, 'w')).toBeNull();
  });
});

describe('distance', () => {
  it('computes straight-line pixel distance', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(distance({ x: 10, y: 10 }, { x: 10, y: 10 })).toBe(0);
  });
});
