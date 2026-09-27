import { describe, expect, it } from 'vitest';

import { chessJsRules } from '../../../chess/chessjs-rules.ts';
import { parseDiagram } from '../../../chess/diagram.ts';
import { createVariantRules } from '../../../variant/rules.ts';
import { submitSelection, toggleSquare } from '../../engine.ts';
import type { ExerciseState } from '../../engine.ts';
import type { SelectSquaresDef } from '../../types.ts';
import type { SeriesGameDef } from './def.ts';
import { completeRound, currentRound, seriesResult, seriesStars, startSeries } from './engine.ts';

const rules = createVariantRules(chessJsRules);

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
