import type { VariantRules } from '../../../variant/rules.ts';
import { selectSquaresAnswer } from '../../engine.ts';
import type { SelectSquaresAction, SelectSquaresDef } from './kind.ts';

/** Toggles every answer square, then submits. */
export function selectSquaresSolution(
  def: SelectSquaresDef,
  ctx: VariantRules,
): readonly SelectSquaresAction[] {
  const answer = selectSquaresAnswer(def, ctx);
  return [
    ...answer.map((square): SelectSquaresAction => ({ type: 'toggle', square })),
    { type: 'submit' },
  ];
}

/** An empty submission (content requires a non-empty answer): exactly 1 error, nothing selected. */
export function selectSquaresWrongAction(): readonly SelectSquaresAction[] {
  return [{ type: 'submit' }];
}
