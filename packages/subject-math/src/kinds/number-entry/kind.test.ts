import { describe, expect, it } from 'vitest';
import { MATH_NOTES } from '../../core/notes.ts';
import type { MathHint, MathState, NumberEntryDef, Problem } from '../../core/types.ts';
import { playSolution, playWrongThenSolve, starsFor } from '../../testing/play.ts';
import { numberEntryKind as kind } from './kind.ts';
import type { Digit, NumberEntryAction } from './kind.ts';
import { numberEntrySolution, numberEntryWrongAction } from './solution.ts';

const def: NumberEntryDef = {
  id: 'ne1',
  concept: 'add-within-5',
  textKey: 'lessons:ne1',
  type: 'number-entry',
  problem: { a: 3, op: '+', b: 2 },
  answer: 5,
};

const enter = (digit: Digit): NumberEntryAction => ({ type: 'enter-digit', digit });
const erase: NumberEntryAction = { type: 'erase-digit' };
const submit: NumberEntryAction = { type: 'submit-number' };

function run(
  actions: readonly NumberEntryAction[],
  from: MathState<NumberEntryDef> = kind.init(def),
): { state: MathState<NumberEntryDef>; outcomes: readonly string[] } {
  let state = from;
  const outcomes: string[] = [];
  for (const action of actions) {
    const step = kind.act(state, action, null);
    state = step.state;
    outcomes.push(step.outcome.kind);
  }
  return { state, outcomes };
}

describe('number-entry digit rules', () => {
  it('appends digits and reports typed', () => {
    const { state, outcomes } = run([enter(1), enter(2)]);
    expect(state.entry).toBe('12');
    expect(outcomes).toEqual(['typed', 'typed']);
  });

  it('ignores a digit once the entry is full', () => {
    const { state, outcomes } = run([enter(1), enter(2), enter(3)]);
    expect(state.entry).toBe('12');
    expect(outcomes).toEqual(['typed', 'typed', 'ignored']);
  });

  it('replaces a lone 0 instead of appending to it', () => {
    expect(run([enter(0), enter(7)]).state.entry).toBe('7');
    expect(run([enter(0), enter(0)]).state.entry).toBe('0');
    expect(run([enter(1), enter(0)]).state.entry).toBe('10');
  });

  it('erase drops the last digit and is ignored when empty', () => {
    const { state, outcomes } = run([erase, enter(4), enter(2), erase, erase, erase]);
    expect(state.entry).toBe('');
    expect(outcomes).toEqual(['ignored', 'typed', 'typed', 'typed', 'typed', 'ignored']);
  });

  it('submit is ignored when empty and never counts a move', () => {
    const { state, outcomes } = run([submit]);
    expect(outcomes).toEqual(['ignored']);
    expect(state).toMatchObject({ moves: 0, errors: 0, solved: false });
  });

  it('a right number solves, counts the move and 0 errors', () => {
    const { state, outcomes } = run([enter(5), submit]);
    expect(outcomes).toEqual(['typed', 'solved']);
    expect(state).toMatchObject({ solved: true, errors: 0, moves: 1, entry: '5' });
  });

  it('a wrong number counts an error and a move, clears the entry and reports the value', () => {
    const step = kind.act(run([enter(4)]).state, submit, null);
    expect(step.outcome).toEqual({ kind: 'wrong', value: 4 });
    expect(step.state).toMatchObject({ errors: 1, moves: 1, entry: '', solved: false });
  });

  it('ignores every action once solved', () => {
    const solved = run([enter(5), submit]).state;
    const { state, outcomes } = run([enter(1), erase, submit], solved);
    expect(outcomes).toEqual(['ignored', 'ignored', 'ignored']);
    expect(state).toBe(solved);
  });
});

describe('number-entry solution and hints', () => {
  it('the solution types the answer and solves with 0 errors and 3 stars', () => {
    expect(numberEntrySolution(def)).toEqual([enter(5), submit]);
    const solved = playSolution(def);
    expect(solved).toMatchObject({ solved: true, errors: 0 });
    expect(starsFor(solved)).toBe(3);
  });

  it('a two-digit answer is typed digit by digit', () => {
    expect(numberEntrySolution({ ...def, answer: 12 })).toEqual([enter(1), enter(2), submit]);
  });

  it('the wrong action gives exactly 1 error, clears the entry and does not block solving', () => {
    expect(numberEntryWrongAction(def)).toEqual([enter(6), submit]);
    const wrong = run(numberEntryWrongAction(def)).state;
    expect(wrong).toMatchObject({ errors: 1, entry: '', solved: false });
    const result = playWrongThenSolve(def);
    expect(result).toMatchObject({ errors: 1, solved: true });
    expect(starsFor(result)).toBe(2);
  });

  it('the wrong action stays a single error for the largest answer', () => {
    const big: NumberEntryDef = { ...def, answer: 99 };
    expect(playWrongThenSolve(big)).toMatchObject({ errors: 1, solved: true });
  });

  it('hint level 1 only raises the level, 2 adds the problem, 3 types the answer in', () => {
    const first = kind.hint(kind.init(def), 1, null);
    expect(first.hint).toEqual({ kind: 'number-entry', level: 1, reveal: false });
    expect(first.state).toMatchObject({ hintLevel: 1, entry: '' });
    const second = kind.hint(first.state, 2, null);
    expect(second.hint).toEqual({
      kind: 'number-entry',
      level: 2,
      reveal: false,
      problem: { a: 3, op: '+', b: 2 },
    });
    const third = kind.hint(second.state, 3, null);
    expect(third.hint).toEqual({ kind: 'number-entry', level: 3, reveal: true });
    expect(third.state).toMatchObject({ hintLevel: 3, entry: '5' });
    expect(kind.act(third.state, submit, null).outcome).toEqual({ kind: 'solved' });
  });

  it('level 2 without a problem carries none', () => {
    const bare: NumberEntryDef = { ...def, problem: undefined };
    expect(kind.hint(kind.init(bare), 2, null).hint).toEqual({
      kind: 'number-entry',
      level: 2,
      reveal: false,
    });
  });

  it('words each hint level', () => {
    const r = (key: string, vars?: Readonly<Record<string, string | number>>): string =>
      vars === undefined ? key : `${key} ${JSON.stringify(vars)}`;
    const text = (hint: MathHint): string => MATH_NOTES.hint.text(r, { kind: 'hint', hint });
    const entry = (level: 1 | 2 | 3, problem?: Problem): MathHint => ({
      kind: 'number-entry',
      level,
      reveal: level === 3,
      ...(problem === undefined ? {} : { problem }),
    });
    expect(text(entry(1))).toBe('math.hint-dots');
    expect(text(entry(2))).toBe('exercise.hint-look');
    expect(text(entry(2, { a: 3, op: '+', b: 2 }))).toBe('math.hint-count-on {"a":3,"b":2}');
    expect(text(entry(2, { a: 5, op: '-', b: 2 }))).toBe('math.hint-count-back {"a":5,"b":2}');
    expect(text(entry(3))).toBe('exercise.hint-answer');
  });

  it('caps stars by hint level and errors', () => {
    const solvedAt = (hintLevel: 0 | 1 | 2 | 3, errors: number): number =>
      kind.stars({ ...kind.init(def), solved: true, hintLevel, errors });
    expect([
      solvedAt(0, 0),
      solvedAt(1, 0),
      solvedAt(0, 1),
      solvedAt(0, 2),
      solvedAt(3, 0),
    ]).toEqual([3, 2, 2, 1, 1]);
  });
});
