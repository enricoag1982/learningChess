import { describe, expect, it } from 'vitest';

import { chessJsRules } from '../chess/chessjs-rules.ts';
import { parseDiagram } from '../chess/diagram.ts';
import { createVariantRules } from '../variant/rules.ts';
import { gameResult, gameStars, playGameMove, startStaticCaptureGame } from './minigame.ts';
import type { StaticCaptureGameDef } from './minigame.ts';

const rules = createVariantRules(chessJsRules);

const TWO_PAWNS = parseDiagram(
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

describe('static capture mini-game', () => {
  it('wins within par for 3 stars', () => {
    const def: StaticCaptureGameDef = {
      id: 'g1',
      concept: 'rook-move',
      position: TWO_PAWNS,
      par: 2,
    };
    let state = startStaticCaptureGame(def);

    const first = playGameMove(state, rules, { from: 'd3', to: 'd4' });
    state = first.state;
    expect(first.outcome.kind).toBe('playing');

    const second = playGameMove(state, rules, { from: 'd4', to: 'd5' });
    state = second.state;

    expect(second.outcome.kind).toBe('won');
    expect(gameResult(state)).toBe('won');
    expect(gameStars(state)).toBe(3);
  });

  it('wins over par for 2 stars', () => {
    const def: StaticCaptureGameDef = {
      id: 'g2',
      concept: 'rook-move',
      position: TWO_PAWNS,
      par: 2,
    };
    let state = startStaticCaptureGame(def);

    state = playGameMove(state, rules, { from: 'd3', to: 'a3' }).state; // wasted move
    state = playGameMove(state, rules, { from: 'a3', to: 'a5' }).state; // wasted move
    state = playGameMove(state, rules, { from: 'a5', to: 'd5' }).state; // captures d5
    const last = playGameMove(state, rules, { from: 'd5', to: 'd4' }); // captures d4
    state = last.state;

    expect(last.outcome.kind).toBe('won');
    expect(gameResult(state)).toBe('won');
    expect(gameStars(state)).toBe(2);
  });

  it('ends at the move limit without winning, for 1 star', () => {
    const def: StaticCaptureGameDef = {
      id: 'g3',
      concept: 'rook-move',
      position: TWO_PAWNS,
      par: 2,
      moveLimit: 1,
    };
    let state = startStaticCaptureGame(def);

    const result = playGameMove(state, rules, { from: 'd3', to: 'd4' }); // only 1 of 2 pawns captured
    state = result.state;

    expect(result.outcome.kind).toBe('ended');
    expect(gameResult(state)).toBe('ended');
    expect(gameStars(state)).toBe(1);
  });

  it('reports playing with no stars until the game ends', () => {
    const def: StaticCaptureGameDef = {
      id: 'g4',
      concept: 'rook-move',
      position: TWO_PAWNS,
      par: 2,
    };
    const state = startStaticCaptureGame(def);

    expect(gameResult(state)).toBe('playing');
    expect(gameStars(state)).toBe(0);
  });
});
