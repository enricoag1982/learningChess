import { describe, expect, it } from 'vitest';
import { evaluate, parseProblem } from './problem.ts';

describe('parseProblem', () => {
  it('reads a sum and a difference of one- and two-digit numbers', () => {
    expect(parseProblem('3 + 2')).toEqual({ a: 3, op: '+', b: 2 });
    expect(parseProblem('12 - 7')).toEqual({ a: 12, op: '-', b: 7 });
    expect(parseProblem('0 + 0')).toEqual({ a: 0, op: '+', b: 0 });
  });

  it.each([
    '3+2',
    '3 plus 2',
    '3 * 2',
    '100 + 1',
    '1 + 100',
    '-1 + 2',
    '1 + 2 + 3',
    ' 1 + 2',
    '1 +',
    '',
  ])('rejects "%s"', (text) => {
    expect(parseProblem(text)).toBeNull();
  });
});

describe('evaluate', () => {
  it('adds and subtracts', () => {
    expect(evaluate({ a: 3, op: '+', b: 2 })).toBe(5);
    expect(evaluate({ a: 9, op: '-', b: 3 })).toBe(6);
    expect(evaluate({ a: 4, op: '-', b: 4 })).toBe(0);
  });
});
