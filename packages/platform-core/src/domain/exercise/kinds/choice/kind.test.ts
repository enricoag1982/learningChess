import { describe, expect, it } from 'vitest';
import { choiceHintText, praiseText } from '../../../note-text.ts';
import type { Resolve } from '../../../notes.ts';
import type { ExerciseStateBase } from '../../../subject.ts';
import { deriveAnswerOutcome } from '../../answer.ts';
import type { AnswerChoiceAction, ChoiceDefBase, ChoiceState } from './def.ts';
import { answerChoice, choiceHint } from './engine.ts';
import { createChoiceKind } from './kind.ts';
import { choiceSolution, choiceWrongAction } from './solution.ts';

const def: ChoiceDefBase = {
  id: 'ch1',
  concept: 'pick',
  textKey: 'ch1.text',
  type: 'choice',
  options: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
  answer: 'b',
};

type State = ExerciseStateBase<ChoiceDefBase> & ChoiceState;

const kind = createChoiceKind<ChoiceDefBase, State, null>((d) => ({
  def: d,
  moves: 0,
  solved: false,
  errors: 0,
  hintLevel: 0,
  wrongOptions: [],
}));

function play(actions: readonly AnswerChoiceAction[]): State {
  let state = kind.init(def);
  for (const action of actions) {
    state = kind.act(state, action, null).state;
  }
  return state;
}

describe('choice kind', () => {
  it('solves on the answer with 3 stars', () => {
    const { state, outcome } = kind.act(
      kind.init(def),
      { type: 'answer-choice', optionId: 'b' },
      null,
    );
    expect(outcome).toEqual({ kind: 'solved' });
    expect(state.solved).toBe(true);
    expect(kind.stars(state)).toBe(3);
  });

  it('a wrong pick counts an error and rules that option out', () => {
    const { state, outcome } = kind.act(
      kind.init(def),
      { type: 'answer-choice', optionId: 'a' },
      null,
    );
    expect(outcome).toEqual({ kind: 'wrong' });
    expect(state).toMatchObject({ errors: 1, solved: false, wrongOptions: ['a'] });
    expect(
      kind.stars(play([{ type: 'answer-choice', optionId: 'a' }, ...choiceSolution(def)])),
    ).toBe(2);
  });

  it('the same wrong option twice is one entry but two errors', () => {
    const state = answerChoice(answerChoice(kind.init(def), 'a'), 'a');
    expect(state.errors).toBe(2);
    expect(state.wrongOptions).toEqual(['a']);
  });

  it('ignores an answer once solved', () => {
    const solved = play(choiceSolution(def));
    const step = kind.act(solved, { type: 'answer-choice', optionId: 'c' }, null);
    expect(step.state).toBe(solved);
    expect(step.outcome).toEqual({ kind: 'ignored' });
  });

  it('hint levels 1 and 2 rule out one wrong option each, level 3 reveals', () => {
    const first = kind.hint(kind.init(def), 1, null);
    expect(first.hint).toEqual({ kind: 'choice', level: 1, reveal: false, removedOptionId: 'a' });
    const second = kind.hint(first.state, 2, null);
    expect(second.hint).toEqual({ kind: 'choice', level: 2, reveal: false, removedOptionId: 'c' });
    expect(second.state.wrongOptions).toEqual(['a', 'c']);
    const third = kind.hint(second.state, 3, null);
    expect(third).toMatchObject({ hint: { kind: 'choice', level: 3, reveal: true } });
    expect(third.state.wrongOptions).toEqual(['a', 'c']);
  });

  it('a hint with no wrong option left removes nothing', () => {
    const state = answerChoice(answerChoice(kind.init(def), 'a'), 'c');
    const { hint, state: next } = choiceHint(state, 2);
    expect(hint).toEqual({ kind: 'choice', level: 2, reveal: false });
    expect(next).toBe(state);
  });

  it('caps stars at 1 after a level-3 hint, at 2 after one hint level or one error', () => {
    const hinted = (level: 1 | 2 | 3): State => ({
      ...kind.init(def),
      hintLevel: level,
      solved: true,
    });
    expect(kind.stars(hinted(1))).toBe(2);
    expect(kind.stars(hinted(2))).toBe(1);
    expect(kind.stars(hinted(3))).toBe(1);
  });

  it('the solution solves with 0 errors, the wrong action gives exactly 1', () => {
    expect(play(choiceSolution(def))).toMatchObject({ solved: true, errors: 0 });
    expect(play(choiceWrongAction(def))).toMatchObject({ solved: false, errors: 1 });
  });

  it('a def with only the answer has no wrong action', () => {
    expect(() => choiceWrongAction({ ...def, options: [{ id: 'b' }] })).toThrow(
      'choice "ch1": no option other than the answer',
    );
  });
});

describe('answer helpers', () => {
  it('derives the outcome from progress before and after', () => {
    const fresh = { solved: false, errors: 0, hintLevel: 0 } as const;
    expect(deriveAnswerOutcome(fresh, { ...fresh, solved: true })).toEqual({ kind: 'solved' });
    expect(deriveAnswerOutcome(fresh, { ...fresh, errors: 1 })).toEqual({ kind: 'wrong' });
    expect(deriveAnswerOutcome(fresh, fresh)).toEqual({ kind: 'ignored' });
  });

  it('words the praise by stars and the choice hint by level', () => {
    const r: Resolve = (key) => key;
    expect([3, 2, 1].map((stars) => praiseText(r, stars))).toEqual([
      'exercise.praise-3',
      'exercise.praise-2',
      'exercise.praise-1',
    ]);
    expect(choiceHintText(r, { kind: 'choice', level: 1, reveal: false })).toBe(
      'exercise.hint-remove-option',
    );
    expect(choiceHintText(r, { kind: 'choice', level: 3, reveal: true })).toBe(
      'exercise.hint-answer',
    );
  });
});
