import { describe, expect, it } from 'vitest';

import { chessJsRules } from '../chess/chessjs-rules.ts';
import { parseDiagram } from '../chess/diagram.ts';
import { parseFen } from '../chess/fen.ts';
import { createVariantRules } from '../variant/rules.ts';
import { playMove, startExercise } from './engine.ts';
import { optimalMoves, solve } from './solver.ts';
import type { CaptureDef, CollectStarsDef } from './types.ts';

const rules = createVariantRules(chessJsRules);

describe('solve', () => {
  it('moves the rook when the line castles (no phantom rook on h1)', () => {
    // Castling collects g1 in one move, but then the rook stands on f1, so h8 needs 2 more moves.
    const position = {
      ...parseFen('8/8/8/8/8/8/8/4K2R w K - 0 1'),
      markers: { stars: ['h8', 'g1'] as const, blocked: [] },
    };
    const line = solve(position, rules, 'collect-stars');
    expect(line).toHaveLength(3);
    const def: CollectStarsDef = {
      id: 'castle',
      concept: 'castling',
      textKey: 'castle',
      type: 'collect-stars',
      position,
      stars3: 3,
      stars2: 4,
    };
    let state = startExercise(def);
    for (const move of line ?? []) {
      const result = playMove(state, rules, move);
      expect(result.outcome.kind).not.toBe('illegal');
      state = result.state;
    }
    expect(state.solved).toBe(true);
  });

  it('finds the shortest collect-stars line', () => {
    const position = parseDiagram(
      [
        '* . . . . . . *',
        '. . . . . . . .',
        '. . . . . . . .',
        '. . . . . . . .',
        '. . . . . . . .',
        '. . . . . . . .',
        '. . . . . . . .',
        'R . . . . . . .',
      ].join('\n'),
    );

    expect(solve(position, rules, 'collect-stars')).toEqual([
      { from: 'a1', to: 'a8' },
      { from: 'a8', to: 'h8' },
    ]);
  });

  it('finds the shortest capture line, forced by the pieces blocking each other', () => {
    const position = parseDiagram(
      [
        '. . . . . . . .',
        '. . . . . . . .',
        '. . . . . . . .',
        '. . . p . . . .',
        '. . . p . . . .',
        '. . . R . . . .',
        '. . . . . . . .',
        '. . . . . . . .',
      ].join('\n'),
    );

    expect(solve(position, rules, 'capture')).toEqual([
      { from: 'd3', to: 'd4' },
      { from: 'd4', to: 'd5' },
    ]);
  });

  it('returns null for a star walled off from the piece', () => {
    const position = parseDiagram(
      [
        '. . . . . . x *',
        '. . . . . . . x',
        '. . . . . . . .',
        '. . . . . . . .',
        '. . . . . . . .',
        '. . . . . . . .',
        '. . . . . . . .',
        'R . . . . . . .',
      ].join('\n'),
    );

    expect(solve(position, rules, 'collect-stars')).toBeNull();
  });

  it('solves a 5-star rook position in under 200ms', () => {
    const position = parseDiagram(
      [
        '* . . . . . . *',
        '. . . . . . . .',
        '. . . . . . . .',
        '. . . * R . . .',
        '. . . . . . . .',
        '. . . . * . . .',
        '. . . . . . . .',
        '* . . . . . . .',
      ].join('\n'),
    );

    const start = performance.now();
    const line = solve(position, rules, 'collect-stars');
    const elapsed = performance.now() - start;

    expect(line).not.toBeNull();
    expect(elapsed).toBeLessThan(200);
  });
});

describe('optimalMoves', () => {
  it('returns the solver line length for collect-stars / capture', () => {
    const collectDef: CollectStarsDef = {
      id: 'ex1',
      concept: 'rook-move',
      textKey: 'ex1.text',
      type: 'collect-stars',
      position: parseDiagram(
        [
          '* . . . . . . *',
          '. . . . . . . .',
          '. . . . . . . .',
          '. . . . . . . .',
          '. . . . . . . .',
          '. . . . . . . .',
          '. . . . . . . .',
          'R . . . . . . .',
        ].join('\n'),
      ),
      stars3: 2,
      stars2: 4,
    };
    expect(optimalMoves(collectDef, rules)).toBe(2);

    const captureDef: CaptureDef = {
      id: 'ex2',
      concept: 'rook-move',
      textKey: 'ex2.text',
      type: 'capture',
      position: parseDiagram(
        [
          '. . . . . . . .',
          '. . . . . . . .',
          '. . . . . . . .',
          '. . . p . . . .',
          '. . . p . . . .',
          '. . . R . . . .',
          '. . . . . . . .',
          '. . . . . . . .',
        ].join('\n'),
      ),
      stars3: 2,
      stars2: 3,
    };
    expect(optimalMoves(captureDef, rules)).toBe(2);
  });

  it('is null for select-squares', () => {
    const def = {
      id: 'ex3',
      concept: 'rook-move',
      textKey: 'ex3.text',
      type: 'select-squares' as const,
      position: parseDiagram(
        [
          '. . . . . . . .',
          '. . . . . . . .',
          '. . . . . . . .',
          '. . . . . . . .',
          '. . . R . . . .',
          '. . . . . . . .',
          '. . . . . . . .',
          '. . . . . . . .',
        ].join('\n'),
      ),
      answer: { derive: 'legal-moves' as const, from: 'd4' as const },
    };
    expect(optimalMoves(def, rules)).toBeNull();
  });
});
