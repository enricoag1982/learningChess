import type { ExerciseStateOf } from '../../core/exercise/state.ts';
import type { Hint } from '../../core/exercise/hint.ts';
import type { ChoiceDef } from '../../core/exercise/types.ts';

/** Correct → solved; wrong → errors + 1 and the option joins `wrongOptions` (disabled in the UI). No-op once solved. */
export function answerChoice(
  state: ExerciseStateOf<ChoiceDef>,
  optionId: string,
): ExerciseStateOf<ChoiceDef> {
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
  state: ExerciseStateOf<ChoiceDef>,
  def: ChoiceDef,
  level: 1 | 2 | 3,
): { readonly state: ExerciseStateOf<ChoiceDef>; readonly hint: Hint } {
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
