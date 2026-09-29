// Note wording a subject's note table shares. Kept apart from `notes.ts` (which the app shell also imports) so a
// subject's own chunk pulls in only these lines.
import type { ChoiceHint } from './exercise/kinds/choice/def.ts';
import type { Resolve } from './notes.ts';

export function praiseText(r: Resolve, stars: number): string {
  if (stars >= 3) return r('exercise.praise-3');
  if (stars === 2) return r('exercise.praise-2');
  return r('exercise.praise-1');
}

export function choiceHintText(r: Resolve, hint: ChoiceHint): string {
  return r(hint.level === 3 ? 'exercise.hint-answer' : 'exercise.hint-remove-option');
}
