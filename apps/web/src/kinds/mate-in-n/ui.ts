import type { ActionOf, DefOf, ExerciseStateOf, OutcomeOf } from '@chess-kids/core/chess';
import type { ExerciseKindUI, UiPatch } from '../kind-ui.ts';
import type { MoveExtra } from '../move-ui.ts';
import { baseInitUi, moveToUi } from '../move-ui.ts';
import { PlayArea } from './PlayArea.tsx';

type MateInNState = ExerciseStateOf<DefOf<'mate-in-n'>>;

export const mateInNUi: ExerciseKindUI<
  DefOf<'mate-in-n'>,
  MateInNState,
  ActionOf<'mate-in-n'>,
  OutcomeOf<'mate-in-n'>,
  MoveExtra
> = {
  type: 'mate-in-n',

  initUi: baseInitUi,

  clearWrongUi: () => ({ wrongSquares: [] }),

  toUi(outcome, _action, next): UiPatch<DefOf<'mate-in-n'>, MateInNState, MoveExtra> {
    if (outcome.kind === 'moved') {
      // Stages the already-applied reply for its delayed reveal; the pre-reply position is
      // `next.history`'s last entry (pushed by `mateInNKind.act`).
      const positionAfterMove = next.history[next.history.length - 1];
      if (positionAfterMove === undefined) {
        throw new Error('mate-in-n toUi: history is missing the pre-reply position');
      }
      return {
        feedback: { kind: 'instruction' },
        hint: null,
        wrongSquares: [],
        wrongMove: undefined,
        lastMove: { from: outcome.move.from, to: outcome.move.to },
        pending: {
          state: { ...next, position: positionAfterMove },
          reveal: {
            lastMove: { from: outcome.reply.from, to: outcome.reply.to },
            feedback: { kind: 'opponent-reply', reply: outcome.reply },
          },
        },
      };
    }
    if (outcome.kind === 'solved') {
      return {
        feedback: { kind: 'checkmate' },
        hint: null,
        wrongSquares: [],
        wrongMove: undefined,
        lastMove: { from: outcome.move.from, to: outcome.move.to },
        pending: undefined,
      };
    }
    // 'illegal' / 'wrong': same shape as every move kind's own outcome.
    return { ...moveToUi(outcome), pending: undefined };
  },

  PlayArea,
};
