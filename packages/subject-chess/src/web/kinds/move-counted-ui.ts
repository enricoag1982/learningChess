import type { ExerciseStateOf } from '../../core/exercise/state.ts';
import type { CaptureDef, CollectStarsDef } from '../../core/exercise/types.ts';
import type { MoveAction } from '../../kinds/base.ts';
import type { MoveOutcome, UndoAction, UndoOutcome } from '../../kinds/static-move.ts';
import type { ExerciseKindUI } from '@learn/platform-web/kinds/kind-ui.ts';
import { CountedPlayArea } from './MovePlayArea.tsx';
import type { MoveExtra } from './move-ui.ts';
import { baseInitUi, moveToUi } from './move-ui.ts';

/** collect-stars / capture UI: a move's usual feedback; an undo drops the last try's highlights. */
export function moveCountedUi<D extends CollectStarsDef | CaptureDef>(
  type: D['type'],
): ExerciseKindUI<
  D,
  ExerciseStateOf<D>,
  MoveAction | UndoAction,
  MoveOutcome | UndoOutcome,
  MoveExtra
> {
  return {
    type,
    initUi: baseInitUi,
    clearWrongUi: () => ({ wrongSquares: [] }),
    toUi(outcome) {
      if (outcome.kind === 'undone') {
        return {
          feedback: { kind: 'instruction' },
          hint: null,
          wrongSquares: [],
          wrongMove: undefined,
          lastMove: undefined,
        };
      }
      return moveToUi(outcome);
    },
    PlayArea: CountedPlayArea,
  };
}
