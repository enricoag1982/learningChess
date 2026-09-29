import { join } from 'node:path';
import type { CompiledContent } from '../../core/chess/lesson.ts';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { chessContent } from '../../content/chess-content.ts';
import { loadLocales } from '@learn/platform-content/load';
import { loadContent } from '@learn/platform-content/lesson-load';
import {
  diagram,
  dir,
  fixturesAfterEach,
  fixturesBeforeEach,
  issuesOf,
  writeDefaultLocales,
  writeLesson,
  writeVersusMiniGame,
} from '../../testing/content-fixtures.ts';

beforeEach(fixturesBeforeEach);
afterEach(fixturesAfterEach);

describe('versus mini-game', () => {
  function compiledVersusGame() {
    writeLesson();
    writeVersusMiniGame();
    writeDefaultLocales();
    const locales = loadLocales(join(dir, 'locales'));
    const content = loadContent<CompiledContent>(
      join(dir, 'lessons'),
      join(dir, 'minigames'),
      locales,
      chessContent,
    );
    const game = content.minigames.find((entry) => entry.id === 'vg1');
    if (game === undefined || game.mode !== 'versus') {
      throw new Error('expected a compiled versus mini-game');
    }
    return game;
  }

  it('loads with no issues and compiles win conditions by kid colour (default white)', () => {
    const game = compiledVersusGame();
    expect(game.kidColor).toBe('w');
    expect(game.opponentLevel).toBe(1);
    expect(game.par).toBe(6);
    expect(game.rules).toEqual({
      kings: false,
      checkRules: false,
      noMoves: 'lose',
      win: {
        w: [{ kind: 'promote' }, { kind: 'capture-all' }],
        b: [{ kind: 'promote' }, { kind: 'capture-all' }],
      },
    });
  });

  it('maps "kid"/"opponent" win lists to the opposite w/b sides when kidColor is black', () => {
    writeLesson();
    writeVersusMiniGame({
      kidColor: 'b',
      board: diagram({ a2: 'P', h2: 'P', a7: 'p', h7: 'p' }),
      rules: {
        kings: false,
        noMoves: 'lose',
        win: { kid: ['capture-all'], opponent: ['promote'] },
      },
    });
    writeDefaultLocales();
    const issues = issuesOf();
    expect(issues).toEqual([]);

    const locales = loadLocales(join(dir, 'locales'));
    const content = loadContent<CompiledContent>(
      join(dir, 'lessons'),
      join(dir, 'minigames'),
      locales,
      chessContent,
    );
    const game = content.minigames.find((entry) => entry.id === 'vg1');
    if (game === undefined || game.mode !== 'versus') {
      throw new Error('expected a compiled versus mini-game');
    }
    expect(game.rules.win.b).toEqual([{ kind: 'capture-all' }]);
    expect(game.rules.win.w).toEqual([{ kind: 'promote' }]);
  });

  it('rejects a bot level out of 1-5', () => {
    writeLesson();
    writeVersusMiniGame({ opponent: { bot: 6 } });
    writeDefaultLocales();

    const issues = issuesOf();
    expect(issues.length).toBeGreaterThan(0);
  });

  it('reports a start position missing a king when rules.kings is true', () => {
    writeLesson();
    writeVersusMiniGame({
      board: diagram({ a2: 'P', h2: 'P', a7: 'p', h7: 'p' }),
      rules: {
        kings: true,
        noMoves: 'draw',
        win: { kid: ['checkmate'], opponent: ['checkmate'] },
      },
    });
    writeDefaultLocales();

    const issues = issuesOf();
    expect(
      issues.some((issue) =>
        issue.includes('rules.kings is true but the start position is missing a king'),
      ),
    ).toBe(true);
  });

  it('reports a king on the board when rules.kings is false', () => {
    writeLesson();
    writeVersusMiniGame({ board: diagram({ a2: 'P', h2: 'P', a7: 'p', h7: 'p', e1: 'K' }) });
    writeDefaultLocales();

    const issues = issuesOf();
    expect(
      issues.some((issue) =>
        issue.includes('rules.kings is false but the start position has a king'),
      ),
    ).toBe(true);
  });

  it('reports a game already over at its start position (no opponent piece: instant capture-all win)', () => {
    writeLesson();
    writeVersusMiniGame({ board: diagram({ a2: 'P' }) });
    writeDefaultLocales();

    const issues = issuesOf();
    expect(
      issues.some((issue) => issue.includes('the game is already over at its start position')),
    ).toBe(true);
  });
});
