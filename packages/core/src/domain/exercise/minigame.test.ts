import { describe, expect, it } from 'vitest';

import { chessJsRules } from '../chess/chessjs-rules.ts';
import { parseDiagram } from '../chess/diagram.ts';
import { createVariantRules } from '../variant/rules.ts';
import { submitSelection, toggleSquare } from './engine.ts';
import type { ExerciseState } from './engine.ts';
import {
  completeRound,
  currentRound,
  gameResult,
  gameStars,
  playGameMove,
  seriesResult,
  seriesStars,
  startSeries,
  startStaticCaptureGame,
} from './minigame.ts';
import type { SeriesGameDef, StaticCaptureGameDef } from './minigame.ts';
import type { SelectSquaresDef } from './types.ts';

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

const TWO_STARS = parseDiagram(
  [
    '. . . . . . . .',
    '. . . . . . . .',
    '. . . . . . . .',
    '. . . * . . . .',
    '. . . * . . . .',
    '. . . R . . . .',
    '. . . . . . . .',
    '. . . . . . . .',
  ].join('\n'),
);

describe('collect-stars mini-game (King Walk / Knight Maze)', () => {
  it('wins within par for 3 stars once every star is collected', () => {
    const def: StaticCaptureGameDef = {
      id: 'g5',
      concept: 'knight-move',
      position: TWO_STARS,
      goal: 'collect-stars',
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

  it('defaults to capture-all when `goal` is omitted', () => {
    const def: StaticCaptureGameDef = {
      id: 'g6',
      concept: 'rook-move',
      position: TWO_PAWNS,
      par: 2,
    };
    let state = startStaticCaptureGame(def);
    // Landing on a star (none here) would solve a collect-stars game after 1 move; capture-all
    // instead needs both pawns taken, confirming the default is still capture-all.
    state = playGameMove(state, rules, { from: 'd3', to: 'd4' }).state;
    expect(gameResult(state)).toBe('playing');
  });

  it('ends at the move limit without collecting every star, for 1 star', () => {
    const def: StaticCaptureGameDef = {
      id: 'g7',
      concept: 'knight-move',
      position: TWO_STARS,
      goal: 'collect-stars',
      par: 2,
      moveLimit: 1,
    };
    let state = startStaticCaptureGame(def);

    const result = playGameMove(state, rules, { from: 'd3', to: 'd4' }); // only 1 of 2 stars
    state = result.state;

    expect(result.outcome.kind).toBe('ended');
    expect(gameResult(state)).toBe('ended');
    expect(gameStars(state)).toBe(1);
  });
});

const EMPTY_BOARD = parseDiagram(Array.from({ length: 8 }, () => '. . . . . . . .').join('\n'));

function roundDef(id: string, answer: readonly ('a1' | 'h8' | 'a2')[]): SelectSquaresDef {
  return {
    id,
    concept: 'board-squares',
    textKey: id,
    position: EMPTY_BOARD,
    type: 'select-squares',
    answer: { squares: answer },
  };
}

describe('series mini-game (Square Hunt / Setup Race)', () => {
  const round1 = roundDef('sq-r1', ['a1']);
  const round2 = roundDef('sq-r2', ['h8']);
  const def: SeriesGameDef = {
    id: 'square-hunt',
    concept: 'board-squares',
    rounds: [round1, round2],
    errors3: 0,
    errors2: 2,
  };

  it('starts at round 0, reports "playing" with no stars', () => {
    const series = startSeries(def);
    expect(series.roundIndex).toBe(0);
    expect(currentRound(series)).toBe(round1);
    expect(series.mistakes).toBe(0);
    expect(seriesResult(series)).toBe('playing');
    expect(seriesStars(series)).toBe(0);
  });

  it('throws when started with no rounds', () => {
    expect(() => startSeries({ ...def, rounds: [] })).toThrow();
  });

  it('completeRound folds errors into mistakes and advances to the next round', () => {
    let series = startSeries(def);
    const solved = submitSelection(toggleSquare(series.round, 'a1'), rules);
    expect(solved.result.correct).toBe(true);

    series = completeRound(series, solved.state);
    expect(series.roundIndex).toBe(1);
    expect(series.mistakes).toBe(0);
    expect(series.done).toBe(false);
    expect(currentRound(series)).toBe(round2);
    expect(seriesResult(series)).toBe('playing');
  });

  it('hints are allowed but fold into mistakes just like an error', () => {
    let series = startSeries(def);
    const solvedWithHint: ExerciseState = {
      ...series.round,
      errors: 0,
      hintLevel: 2,
      solved: true,
    };
    series = completeRound(series, solvedWithHint);
    expect(series.mistakes).toBe(2);
  });

  it('marks the series done after the last round; stars from total mistakes (3 <= errors3, 2 <= errors2, else 1)', () => {
    let series = startSeries(def);
    const firstSolved = submitSelection(toggleSquare(series.round, 'a1'), rules);
    series = completeRound(series, firstSolved.state); // 0 mistakes so far

    // Round 2: one wrong try (error), then the correct square.
    const wrong = submitSelection(toggleSquare(series.round, 'a2'), rules);
    expect(wrong.result.correct).toBe(false);
    const reselected = toggleSquare(toggleSquare(wrong.state, 'a2'), 'h8'); // deselect wrong, pick right
    const solved = submitSelection(reselected, rules);
    expect(solved.result.correct).toBe(true);

    series = completeRound(series, solved.state);
    expect(series.done).toBe(true);
    expect(series.mistakes).toBe(1);
    expect(seriesResult(series)).toBe('won');
    // 1 mistake: above errors3 (0), at/under errors2 (2) -> 2 stars.
    expect(seriesStars(series)).toBe(2);
    expect(currentRound(series)).toBe(round2);
  });

  it('1 star ("finished") once total mistakes exceed errors2', () => {
    let series = startSeries({ ...def, errors3: 0, errors2: 0 });
    const solved1 = submitSelection(toggleSquare(series.round, 'a1'), rules);
    series = completeRound(series, solved1.state);
    const wrong = submitSelection(toggleSquare(series.round, 'a2'), rules);
    const reselected = toggleSquare(toggleSquare(wrong.state, 'a2'), 'h8');
    const solved2 = submitSelection(reselected, rules);
    series = completeRound(series, solved2.state);

    expect(series.mistakes).toBe(1);
    expect(seriesStars(series)).toBe(1);
  });
});
