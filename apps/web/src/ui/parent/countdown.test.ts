import { describe, expect, it } from 'vitest';
import { formatCountdown } from './countdown.ts';

describe('formatCountdown', () => {
  it('formats whole minutes', () => {
    expect(formatCountdown(60_000)).toBe('1:00');
  });

  it('pads seconds under 10', () => {
    expect(formatCountdown(42_000)).toBe('0:42');
    expect(formatCountdown(5_000)).toBe('0:05');
  });

  it('rounds up to the next second', () => {
    expect(formatCountdown(42_300)).toBe('0:43');
  });

  it('clamps negative values to 0:00', () => {
    expect(formatCountdown(-500)).toBe('0:00');
  });
});
