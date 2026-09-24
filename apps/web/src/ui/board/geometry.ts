import type { Color, File, Rank, Square } from '@chess-kids/core';

const FILES: readonly File[] = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS: readonly Rank[] = ['1', '2', '3', '4', '5', '6', '7', '8'];

/** A point in the same coordinate space as a `Rect` (e.g. pointer client coordinates). */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/** A rectangle in that same space (the subset of `DOMRect` geometry needs). */
export interface Rect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** 0-based grid cell of a square: row 0 is the visual top row, column 0 the visual left column. */
export interface Cell {
  readonly row: number;
  readonly col: number;
}

/** Visual cell of `square` for a board drawn with `orientation` at the bottom. */
export function squareToCell(square: Square, orientation: Color): Cell {
  const fileIndex = FILES.indexOf(square[0] as File);
  const rankIndex = RANKS.indexOf(square[1] as Rank);
  return orientation === 'w'
    ? { row: 7 - rankIndex, col: fileIndex }
    : { row: rankIndex, col: 7 - fileIndex };
}

/** Inverse of `squareToCell`; `null` when the cell falls outside the 8x8 grid. */
export function cellToSquare(row: number, col: number, orientation: Color): Square | null {
  if (row < 0 || row > 7 || col < 0 || col > 7) return null;
  const rankIndex = orientation === 'w' ? 7 - row : row;
  const fileIndex = orientation === 'w' ? col : 7 - col;
  const file = FILES[fileIndex];
  const rank = RANKS[rankIndex];
  return file !== undefined && rank !== undefined ? `${file}${rank}` : null;
}

/** Square under `point` on a board drawn inside `rect`, or `null` when the point falls outside it. */
export function squareAt(point: Point, rect: Rect, orientation: Color = 'w'): Square | null {
  if (rect.width <= 0 || rect.height <= 0) return null;
  const x = point.x - rect.left;
  const y = point.y - rect.top;
  if (x < 0 || y < 0 || x >= rect.width || y >= rect.height) return null;
  const col = Math.min(7, Math.floor((x / rect.width) * 8));
  const row = Math.min(7, Math.floor((y / rect.height) * 8));
  return cellToSquare(row, col, orientation);
}

/** Straight-line pixel distance between two points (drag-vs-tap threshold). */
export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
