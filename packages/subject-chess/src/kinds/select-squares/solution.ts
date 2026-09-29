import type { VariantRules } from '../../core/variant/rules.ts';
import { selectSquaresAnswer } from './engine.ts';
import type { SelectSquaresAction } from './kind.ts';
import type { SelectSquaresDef } from '../../core/exercise/types.ts';

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
