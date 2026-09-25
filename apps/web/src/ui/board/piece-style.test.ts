import { describe, expect, it } from 'vitest';
import { parseFen } from '@chess-kids/core';
import { isClassicOnlyContext, isWorldFive, showPieceBadges } from './piece-style.ts';

const STANDARD_START = parseFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
const NOT_STANDARD_START = parseFen('4k3/8/8/8/8/8/4P3/4K3 w - - 0 1');

describe('isWorldFive', () => {
  it('is true only for the "rules" world id', () => {
    expect(isWorldFive('rules')).toBe(true);
    expect(isWorldFive('check')).toBe(false);
    expect(isWorldFive('board')).toBe(false);
  });
});

describe('isClassicOnlyContext', () => {
  it('is classic-only for a World 5 lesson, regardless of any game context', () => {
    expect(isClassicOnlyContext({ worldId: 'rules' })).toBe(true);
  });

  it('is classic-only for a full game: kings on the board + standard start position', () => {
    expect(isClassicOnlyContext({ kings: true, position: STANDARD_START })).toBe(true);
  });

  it('is not classic-only for a variant versus mini-game (kings on, not the standard start)', () => {
    expect(isClassicOnlyContext({ kings: true, position: NOT_STANDARD_START })).toBe(false);
  });

  it('is not classic-only for a kingless versus mini-game at the standard start board', () => {
    expect(isClassicOnlyContext({ kings: false, position: STANDARD_START })).toBe(false);
  });

  it('is not classic-only for an ordinary Worlds 1-4 lesson with no game context', () => {
    expect(isClassicOnlyContext({ worldId: 'pieces' })).toBe(false);
    expect(isClassicOnlyContext({})).toBe(false);
  });
});

describe('showPieceBadges', () => {
  it('"classic" forces classic pieces everywhere, even outside a classic-only context', () => {
    expect(showPieceBadges('classic', false)).toBe(false);
    expect(showPieceBadges('classic', true)).toBe(false);
  });

  it('"animal" shows badges except in a classic-only context', () => {
    expect(showPieceBadges('animal', false)).toBe(true);
    expect(showPieceBadges('animal', true)).toBe(false);
  });
});
