import { describe, expect, it } from 'vitest';

import { chessJsRules } from '../../../chess/chessjs-rules.ts';
import { parseDiagram } from '../../../chess/diagram.ts';
import { createVariantRules } from '../../../variant/rules.ts';
import { answerYesNo, requestHint, starsFor, startExercise } from '../../engine.ts';
import type { YesNoDef } from '../../types.ts';

const rules = createVariantRules(chessJsRules);

describe('yes-no', () => {
  const position = parseDiagram(
    [
      '. . . . . . . .',
      '. . . . . . . .',
      '. . . . . . . .',
      '. . . . . . . .',
      '. . . . p . . .',
      '. . . . . . . .',
      '. . . . . . . .',
      '. . . . . . . .',
    ].join('\n'),
  );
  const def: YesNoDef = {
    id: 'yn1',
    concept: 'hanging-piece',
    textKey: 'yn1.text',
    type: 'yes-no',
    position,
    answer: true,
    focus: 'e4',
  };

  it('solves on the correct answer', () => {
    const state = answerYesNo(startExercise(def), true);
    expect(state.solved).toBe(true);
    expect(starsFor(state)).toBe(3);
  });

  it('a wrong answer counts an error and can be retried', () => {
    let state = answerYesNo(startExercise(def), false);
    expect(state.errors).toBe(1);
    expect(state.solved).toBe(false);

    state = answerYesNo(state, true);
    expect(state.solved).toBe(true);
    expect(starsFor(state)).toBe(2);
  });

  it('is a no-op once solved', () => {
    const solved = answerYesNo(startExercise(def), true);
    expect(answerYesNo(solved, false)).toEqual(solved);
  });

  it('hint ladder: focus square, then a nudge, then reveal', () => {
    let state = startExercise(def);

    const hint1 = requestHint(state, rules);
    expect(hint1.hint).toEqual({ kind: 'yes-no', level: 1, squares: ['e4'], reveal: false });
    state = hint1.state;

    const hint2 = requestHint(state, rules);
    expect(hint2.hint).toEqual({ kind: 'yes-no', level: 2, squares: [], reveal: false });
    state = hint2.state;

    const hint3 = requestHint(state, rules);
    expect(hint3.hint).toEqual({ kind: 'yes-no', level: 3, squares: ['e4'], reveal: true });
  });

  it('has no focus squares to highlight when the exercise sets none', () => {
    const noFocus: YesNoDef = { ...def, focus: undefined };
    const hint = requestHint(startExercise(noFocus), rules).hint;
    expect(hint).toEqual({ kind: 'yes-no', level: 1, squares: [], reveal: false });
  });
});
