import { describe, expect, it } from 'vitest';
import type { MathChoiceDef } from '../../core/types.ts';
import { MATH_NOTES } from '../../core/notes.ts';
import { playSolution, playWrongThenSolve, starsFor } from '../../testing/play.ts';
import { mathChoiceKind as kind } from './kind.ts';

const def: MathChoiceDef = {
  id: 'ch1',
  concept: 'add-within-5',
  textKey: 'lessons:ch1',
  type: 'choice',
  problem: { a: 2, op: '+', b: 2 },
  options: [
    { id: 'a', value: 3 },
    { id: 'b', value: 4 },
    { id: 'c', value: 5 },
  ],
  answer: 'b',
};

describe('math choice kind', () => {
  it('starts with an empty entry and no progress', () => {
    expect(kind.init(def)).toEqual({
      def,
      moves: 0,
      solved: false,
      errors: 0,
      hintLevel: 0,
      entry: '',
    });
  });

  it('the solution solves with 0 errors and 3 stars', () => {
    const solved = playSolution(def);
    expect(solved).toMatchObject({ solved: true, errors: 0 });
    expect(starsFor(solved)).toBe(3);
  });

  it('the wrong action costs exactly 1 error, rules the option out and does not block solving', () => {
    const wrong = kind.act(kind.init(def), { type: 'answer-choice', optionId: 'a' }, null);
    expect(wrong.outcome).toEqual({ kind: 'wrong' });
    expect(wrong.state).toMatchObject({ errors: 1, solved: false, wrongOptions: ['a'] });
    const result = playWrongThenSolve(def);
    expect(result).toMatchObject({ errors: 1, solved: true });
    expect(starsFor(result)).toBe(2);
  });

  it('hint levels 1 and 2 rule out one wrong option each, level 3 reveals', () => {
    const first = kind.hint(kind.init(def), 1, null);
    expect(first.hint).toEqual({ kind: 'choice', level: 1, reveal: false, removedOptionId: 'a' });
    expect(first.state.wrongOptions).toEqual(['a']);
    const second = kind.hint(first.state, 2, null);
    expect(second.hint).toEqual({ kind: 'choice', level: 2, reveal: false, removedOptionId: 'c' });
    const third = kind.hint(second.state, 3, null);
    expect(third.hint).toEqual({ kind: 'choice', level: 3, reveal: true });
    const r = (key: string): string => key;
    expect(MATH_NOTES.hint.text(r, { kind: 'hint', hint: first.hint })).toBe(
      'exercise.hint-remove-option',
    );
    expect(MATH_NOTES.hint.text(r, { kind: 'hint', hint: third.hint })).toBe(
      'exercise.hint-answer',
    );
  });

  it('caps stars by hint level and errors', () => {
    const solvedAt = (hintLevel: 0 | 1 | 2 | 3, errors: number): number =>
      kind.stars({ ...kind.init(def), solved: true, hintLevel, errors });
    expect([
      solvedAt(0, 0),
      solvedAt(1, 0),
      solvedAt(0, 1),
      solvedAt(2, 0),
      solvedAt(3, 0),
    ]).toEqual([3, 2, 2, 1, 1]);
  });
});
