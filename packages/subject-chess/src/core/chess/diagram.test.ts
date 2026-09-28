import { describe, expect, it } from 'vitest';

import { DiagramError, parseDiagram, toDiagram } from './diagram.ts';
import type { Position } from './types.ts';

const EXAMPLE = [
  '. . . . * . . .',
  '. . . . . . . .',
  '. . . . . . . .',
  '* . . . * . . .',
  '. . . . . . . .',
  '. . . . . . . .',
  '. . . . . . . .',
  'R . . . . . . .',
].join('\n');

function line(lines: readonly string[], index: number): string {
  const value = lines[index];
  if (value === undefined) {
    throw new Error(`test setup error: no line ${String(index)}`);
  }
  return value;
}

const EXPECTED: Position = {
  pieces: { a1: { color: 'w', type: 'r' } },
  markers: { stars: ['e8', 'a5', 'e5'], blocked: [] },
  toMove: 'w',
  castling: '-',
  enPassant: null,
};

describe('parseDiagram', () => {
  it('parses the doc example into the exact position', () => {
    expect(parseDiagram(EXAMPLE)).toEqual(EXPECTED);
  });

  it('parses blocked squares', () => {
    const diagram = [
      '. . . . . . . .',
      '. . . . . . . .',
      '. . . . . . . .',
      '. . . x . . . .',
      '. . . . . . . .',
      '. . . . . . . .',
      '. . . . . . . .',
      '. . . . . . . .',
    ].join('\n');

    expect(parseDiagram(diagram).markers).toEqual({ stars: [], blocked: ['d5'] });
  });

  it('tolerates indentation and leading/trailing blank lines', () => {
    const padded = ['', '   ', ...EXAMPLE.split('\n').map((text) => `    ${text}  `), '', ''].join(
      '\n',
    );

    expect(parseDiagram(padded)).toEqual(EXPECTED);
  });

  it('rejects the wrong number of rows', () => {
    const sevenRows = EXAMPLE.split('\n').slice(0, 7).join('\n');
    expect(() => parseDiagram(sevenRows)).toThrow(DiagramError);
    expect(() => parseDiagram(sevenRows)).toThrow('expected 8 rows, got 7');
  });

  it('rejects a row with the wrong number of squares', () => {
    const rows = EXAMPLE.split('\n');
    rows[2] = `${line(rows, 2)} .`;
    expect(() => parseDiagram(rows.join('\n'))).toThrow('row 3: expected 8 squares, got 9');
  });

  it('rejects an unknown symbol with a 1-based row and column', () => {
    const rows = EXAMPLE.split('\n');
    const row = line(rows, 1).split(' ');
    row[4] = 'z';
    rows[1] = row.join(' ');
    expect(() => parseDiagram(rows.join('\n'))).toThrow('row 2, column 5: unknown symbol "z"');
  });

  it('defaults toMove to white and accepts an override', () => {
    expect(parseDiagram(EXAMPLE).toMove).toBe('w');
    expect(parseDiagram(EXAMPLE, { toMove: 'b' }).toMove).toBe('b');
  });
});

describe('toDiagram', () => {
  it('is the exact inverse of parseDiagram for normalised input', () => {
    expect(toDiagram(parseDiagram(EXAMPLE))).toBe(EXAMPLE);
  });
});
