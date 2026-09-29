import { describe, expect, it } from 'vitest';

import { chessJsRules } from '../../core/chess/chessjs-rules.ts';
import { parseDiagram } from '../../core/chess/diagram.ts';
import { createVariantRules } from '../../core/variant/rules.ts';
import { requestHint, starsFor } from '../../testing/kind-steps.ts';
import { initState } from '../../core/exercise/state.ts';
import type { ExerciseState, ExerciseStateOf } from '../../core/exercise/state.ts';
import { answerChoice } from '@learn/platform-core/domain/exercise/kinds/choice/engine';
import type { ChoiceDef } from '../../core/exercise/types.ts';

const rules = createVariantRules(chessJsRules);

/** `requestHint` dispatches generically; this test drives one exercise type throughout, so it
 * narrows the result back to call the type-specific helpers below. */
function narrow(state: ExerciseState): ExerciseStateOf<ChoiceDef> {
  return state as ExerciseStateOf<ChoiceDef>;
}

describe('choice', () => {
  const position = parseDiagram(
    [
      '. . . . . . . .',
      '. . . . . . . .',
      '. . . . . . . .',
      '. . . . . . . .',
      '. . . . . . . .',
      '. . . . . . . .',
      '. . . . . . . .',
      '. . . . . . . .',
    ].join('\n'),
  );
  const def: ChoiceDef = {
    id: 'ch1',
    concept: 'exchange',
    textKey: 'ch1.text',
    type: 'choice',
    position,
    showBoard: false,
    options: [
      { id: 'queen', textKey: 'ch1.queen' },
      { id: 'rook', textKey: 'ch1.rook' },
      { id: 'bishop', textKey: 'ch1.bishop' },
    ],
    answer: 'queen',
  };

  it('solves on the correct option', () => {
    const state = answerChoice(initState(def), 'queen');
    expect(state.solved).toBe(true);
    expect(starsFor(state)).toBe(3);
  });

  it('a wrong pick counts an error and disables that option', () => {
    let state = answerChoice(initState(def), 'rook');
    expect(state.errors).toBe(1);
    expect(state.wrongOptions).toEqual(['rook']);
    expect(state.solved).toBe(false);

    state = answerChoice(state, 'queen');
    expect(state.solved).toBe(true);
    expect(starsFor(state)).toBe(2);
  });

  it('picking the same wrong option twice only disables it once', () => {
    let state = answerChoice(initState(def), 'rook');
    state = answerChoice(state, 'rook');
    expect(state.errors).toBe(2);
    expect(state.wrongOptions).toEqual(['rook']);
  });

  it('is a no-op once solved', () => {
    const solved = answerChoice(initState(def), 'queen');
    expect(answerChoice(solved, 'rook')).toEqual(solved);
  });

  it('hint ladder removes one wrong option per level, then reveals', () => {
    let state = initState(def);

    const hint1 = requestHint(state, rules);
    expect(hint1.hint).toMatchObject({ kind: 'choice', level: 1, reveal: false });
    state = narrow(hint1.state);
    expect(state.wrongOptions).toHaveLength(1);
    expect(state.wrongOptions?.[0]).not.toBe('queen');

    const hint2 = requestHint(state, rules);
    state = narrow(hint2.state);
    expect(state.wrongOptions).toHaveLength(2);
    expect(state.wrongOptions).toEqual(expect.arrayContaining(['rook', 'bishop']));

    const hint3 = requestHint(state, rules);
    expect(hint3.hint).toEqual({ kind: 'choice', level: 3, reveal: true });
  });

  it('caps stars at 1 after a level-3 hint even with no errors', () => {
    let state = initState(def);
    state = narrow(requestHint(state, rules).state);
    state = narrow(requestHint(state, rules).state);
    state = narrow(requestHint(state, rules).state);
    state = answerChoice(state, 'queen');
    expect(starsFor(state)).toBe(1);
  });
});
