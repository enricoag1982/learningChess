import type { ExerciseState } from '../../engine.ts';
import type { Hint } from '../../hint.ts';
import type { ChoiceDef } from '../../types.ts';

/**
 * Picks an option for a choice exercise. Correct → solved; wrong → errors + 1 and the option is
 * added to `wrongOptions` (disabled in the UI). No-op once solved.
 */
export function answerChoice(state: ExerciseState, optionId: string): ExerciseState {
  if (state.def.type !== 'choice') {
    throw new Error('answerChoice: exercise is not choice');
  }
  if (state.solved) {
    return state;
  }
  if (optionId === state.def.answer) {
    return { ...state, solved: true };
  }
  const current = state.wrongOptions ?? [];
  const wrongOptions = current.includes(optionId) ? current : [...current, optionId];
  return { ...state, errors: state.errors + 1, wrongOptions };
}

export function choiceHint(
  state: ExerciseState,
  def: ChoiceDef,
  level: 1 | 2 | 3,
): { readonly state: ExerciseState; readonly hint: Hint } {
  if (level === 3) {
    return { state, hint: { kind: 'choice', level: 3, reveal: true } };
  }
  const current = state.wrongOptions ?? [];
  const removedOptionId = def.options
    .map((option) => option.id)
    .find((id) => id !== def.answer && !current.includes(id));
  const nextState =
    removedOptionId === undefined
      ? state
      : { ...state, wrongOptions: [...current, removedOptionId] };
  return {
    state: nextState,
    hint: {
      kind: 'choice',
      level,
      reveal: false,
      ...(removedOptionId === undefined ? {} : { removedOptionId }),
    },
  };
}
