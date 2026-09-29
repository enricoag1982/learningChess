import type { ChoiceHint, ChoiceState } from './def.ts';

/** Correct → solved; wrong → errors + 1 and the option joins `wrongOptions`. No-op once solved. */
export function answerChoice<S extends ChoiceState>(state: S, optionId: string): S {
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

/** Levels 1-2 rule out one wrong option each; level 3 reveals the answer. */
export function choiceHint<S extends ChoiceState>(
  state: S,
  level: 1 | 2 | 3,
): { readonly state: S; readonly hint: ChoiceHint } {
  if (level === 3) {
    return { state, hint: { kind: 'choice', level: 3, reveal: true } };
  }
  const current = state.wrongOptions ?? [];
  const removedOptionId = state.def.options
    .map((option) => option.id)
    .find((id) => id !== state.def.answer && !current.includes(id));
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
