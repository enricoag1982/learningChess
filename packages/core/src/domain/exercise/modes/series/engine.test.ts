import { describe, expect, it } from 'vitest';

import { chessJsRules } from '../../../chess/chessjs-rules.ts';
import { parseDiagram } from '../../../chess/diagram.ts';
import { createVariantRules } from '../../../variant/rules.ts';
import { EXERCISE_KINDS } from '../../kinds/index.ts';
import { submitSelection, toggleSquare } from '../../kinds/select-squares/engine.ts';
import type { ExerciseStateOf } from '../../state.ts';
import type { ExerciseStateBase } from '../../../subject.ts';
import type { SelectSquaresDef } from '../../types.ts';
import type { SeriesGameDef } from './def.ts';
import { completeRound, currentRound, seriesResult, seriesStars, startSeries } from './engine.ts';

/** This suite plays every round as `select-squares`; `EXERCISE_KINDS` is chess's own full
 * registry (`createSubjectRuntime`'s job elsewhere) — `startSeries`/`completeRound` no longer
 * hardcode it (leak #3). */
function start(def: SeriesGameDef<SelectSquaresDef>) {
  return startSeries(def, EXERCISE_KINDS);
}
function complete(
  series: ReturnType<typeof start>,
  roundState: ExerciseStateBase<SelectSquaresDef>,
) {
  return completeRound(series, roundState, EXERCISE_KINDS);
}

const rules = createVariantRules(chessJsRules);

const EMPTY_BOARD = parseDiagram(Array.from({ length: 8 }, () => '. . . . . . . .').join('\n'));

/** A series round's own state is generic (any exercise type); every round here is authored as
 * select-squares, so this test narrows it to call that kind's own engine directly. */
function asSelectSquares(
  state: ExerciseStateBase<SelectSquaresDef>,
): ExerciseStateOf<SelectSquaresDef> {
  return state as ExerciseStateOf<SelectSquaresDef>;
}

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
  const def: SeriesGameDef<SelectSquaresDef> = {
    id: 'square-hunt',
    concept: 'board-squares',
    rounds: [round1, round2],
    errors3: 0,
    errors2: 2,
  };

  it('starts at round 0, reports "playing" with no stars', () => {
    const series = start(def);
    expect(series.roundIndex).toBe(0);
    expect(currentRound(series)).toBe(round1);
    expect(series.mistakes).toBe(0);
    expect(seriesResult(series)).toBe('playing');
    expect(seriesStars(series)).toBe(0);
  });

  it('throws when started with no rounds', () => {
    expect(() => start({ ...def, rounds: [] })).toThrow();
  });

  it('completeRound folds errors into mistakes and advances to the next round', () => {
    let series = start(def);
    const solved = submitSelection(toggleSquare(asSelectSquares(series.round), 'a1'), rules);
    expect(solved.result.correct).toBe(true);

    series = complete(series, solved.state);
    expect(series.roundIndex).toBe(1);
    expect(series.mistakes).toBe(0);
    expect(series.done).toBe(false);
    expect(currentRound(series)).toBe(round2);
    expect(seriesResult(series)).toBe('playing');
  });

  it('hints are allowed but fold into mistakes just like an error', () => {
    let series = start(def);
    const solvedWithHint: ExerciseStateBase<SelectSquaresDef> = {
      ...series.round,
      errors: 0,
      hintLevel: 2,
      solved: true,
    };
    series = complete(series, solvedWithHint);
    expect(series.mistakes).toBe(2);
  });

  it('marks the series done after the last round; stars from total mistakes (3 <= errors3, 2 <= errors2, else 1)', () => {
    let series = start(def);
    const firstSolved = submitSelection(toggleSquare(asSelectSquares(series.round), 'a1'), rules);
    series = complete(series, firstSolved.state); // 0 mistakes so far

    // Round 2: one wrong try (error), then the correct square.
    const wrong = submitSelection(toggleSquare(asSelectSquares(series.round), 'a2'), rules);
    expect(wrong.result.correct).toBe(false);
    const reselected = toggleSquare(toggleSquare(wrong.state, 'a2'), 'h8'); // deselect wrong, pick right
    const solved = submitSelection(reselected, rules);
    expect(solved.result.correct).toBe(true);

    series = complete(series, solved.state);
    expect(series.done).toBe(true);
    expect(series.mistakes).toBe(1);
    expect(seriesResult(series)).toBe('won');
    // 1 mistake: above errors3 (0), at/under errors2 (2) -> 2 stars.
    expect(seriesStars(series)).toBe(2);
    expect(currentRound(series)).toBe(round2);
  });

  it('1 star ("finished") once total mistakes exceed errors2', () => {
    let series = start({ ...def, errors3: 0, errors2: 0 });
    const solved1 = submitSelection(toggleSquare(asSelectSquares(series.round), 'a1'), rules);
    series = complete(series, solved1.state);
    const wrong = submitSelection(toggleSquare(asSelectSquares(series.round), 'a2'), rules);
    const reselected = toggleSquare(toggleSquare(wrong.state, 'a2'), 'h8');
    const solved2 = submitSelection(reselected, rules);
    series = complete(series, solved2.state);

    expect(series.mistakes).toBe(1);
    expect(seriesStars(series)).toBe(1);
  });
});
