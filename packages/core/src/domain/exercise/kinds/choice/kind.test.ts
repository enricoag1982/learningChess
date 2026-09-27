import { describe, expect, it } from 'vitest';

import { chessJsRules } from '../../../chess/chessjs-rules.ts';
import { parseDiagram } from '../../../chess/diagram.ts';
import { createVariantRules } from '../../../variant/rules.ts';
import { answerChoice, requestHint, starsFor, startExercise } from '../../engine.ts';
import type { ChoiceDef } from '../../types.ts';

const rules = createVariantRules(chessJsRules);

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
    const state = answerChoice(startExercise(def), 'queen');
    expect(state.solved).toBe(true);
    expect(starsFor(state)).toBe(3);
  });

  it('a wrong pick counts an error and disables that option', () => {
    let state = answerChoice(startExercise(def), 'rook');
    expect(state.errors).toBe(1);
    expect(state.wrongOptions).toEqual(['rook']);
    expect(state.solved).toBe(false);

    state = answerChoice(state, 'queen');
    expect(state.solved).toBe(true);
    expect(starsFor(state)).toBe(2);
  });

  it('picking the same wrong option twice only disables it once', () => {
    let state = answerChoice(startExercise(def), 'rook');
    state = answerChoice(state, 'rook');
    expect(state.errors).toBe(2);
    expect(state.wrongOptions).toEqual(['rook']);
  });

  it('is a no-op once solved', () => {
    const solved = answerChoice(startExercise(def), 'queen');
    expect(answerChoice(solved, 'rook')).toEqual(solved);
  });

  it('hint ladder removes one wrong option per level, then reveals', () => {
    let state = startExercise(def);

    const hint1 = requestHint(state, rules);
    expect(hint1.hint).toMatchObject({ kind: 'choice', level: 1, reveal: false });
    state = hint1.state;
    expect(state.wrongOptions).toHaveLength(1);
    expect(state.wrongOptions?.[0]).not.toBe('queen');

    const hint2 = requestHint(state, rules);
    state = hint2.state;
    expect(state.wrongOptions).toHaveLength(2);
    expect(state.wrongOptions).toEqual(expect.arrayContaining(['rook', 'bishop']));

    const hint3 = requestHint(state, rules);
    expect(hint3.hint).toEqual({ kind: 'choice', level: 3, reveal: true });
  });

  it('caps stars at 1 after a level-3 hint even with no errors', () => {
    let state = startExercise(def);
    state = requestHint(state, rules).state;
    state = requestHint(state, rules).state;
    state = requestHint(state, rules).state;
    state = answerChoice(state, 'queen');
    expect(starsFor(state)).toBe(1);
  });
});
