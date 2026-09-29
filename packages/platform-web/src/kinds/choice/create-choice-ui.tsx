import type { JSX } from 'react';
import type { ExerciseStateBase } from '@learn/platform-core';
import type { AnswerOutcome } from '@learn/platform-core/domain/exercise/answer';
import type {
  AnswerChoiceAction,
  ChoiceDefBase,
  ChoiceState,
} from '@learn/platform-core/domain/exercise/kinds/choice/def';
import { ExerciseControls } from '../ExerciseControls.tsx';
import { ExerciseFrame } from '../ExercisePlay.tsx';
import type { ExerciseKindUI, PlayAreaProps } from '../kind-ui.ts';
import { panelBody } from '../panel-body.tsx';
import { ChoiceOptions } from './ChoiceOptions.tsx';
import type { ChoiceLook } from './ChoiceOptions.tsx';

export interface ChoiceUiSpec<
  D extends ChoiceDefBase,
  S extends ExerciseStateBase<D> & ChoiceState<D>,
  Extra extends object,
> {
  initUi(def: D): Extra;
  /** Extras a hint request clears: the kind's own "wrong" markers. */
  clearWrongUi(): Partial<Extra>;
  /** What the options answer (chess: the board); called as a function, so it may use hooks. `null` gives
   * the options the full width. */
  stimulus(props: PlayAreaProps<D, S, AnswerChoiceAction, Extra>): JSX.Element | null;
  readonly look: ChoiceLook<D['options'][number]>;
}

/** The `choice` kind's UI: the stimulus beside a Hint button and the option tiles. */
export function createChoiceUi<
  D extends ChoiceDefBase,
  S extends ExerciseStateBase<D> & ChoiceState<D>,
  Extra extends object,
>(spec: ChoiceUiSpec<D, S, Extra>): ExerciseKindUI<D, S, AnswerChoiceAction, AnswerOutcome, Extra> {
  return {
    type: 'choice',

    initUi: (def) => spec.initUi(def),

    clearWrongUi: () => spec.clearWrongUi(),

    toUi(outcome) {
      // 'ignored' (already solved): the tiles are hidden by then, unreachable in the UI.
      const kind = outcome.kind === 'wrong' ? 'wrong-answer' : 'solved';
      return { feedback: { kind }, hint: null, ...spec.clearWrongUi() };
    },

    PlayArea(props) {
      const { def, state, dispatch, showHint, top, done } = props;
      const controls = (
        <>
          <ExerciseControls
            showHint={showHint}
            onHint={() => {
              dispatch({ type: 'hint' });
            }}
          />
          <ChoiceOptions
            options={def.options}
            wrongOptionIds={state.core.wrongOptions ?? []}
            onPick={(optionId) => {
              dispatch({ type: 'answer-choice', optionId });
            }}
            look={spec.look}
          />
        </>
      );
      return (
        <ExerciseFrame
          board={spec.stimulus(props)}
          panel={panelBody(top, state.core.solved, done, controls)}
        />
      );
    },
  };
}
