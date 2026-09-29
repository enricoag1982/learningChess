import type { JSX } from 'react';
import { ExerciseControls } from '@learn/platform-web/kinds/ExerciseControls.tsx';
import { ExerciseFrame } from '@learn/platform-web/kinds/ExercisePlay.tsx';
import { panelBody } from '@learn/platform-web/kinds/panel-body.tsx';
import { ProblemCard } from '../../web/problem-card.tsx';
import { EntryDisplay } from './EntryDisplay.tsx';
import { NumberPad } from './NumberPad.tsx';
import type { NumberEntryPlayAreaProps } from './ui.ts';

/** The problem card beside the Hint button, what has been typed and the number pad. */
export function PlayArea({
  def,
  state,
  dispatch,
  showHint,
  top,
  done,
}: NumberEntryPlayAreaProps): JSX.Element {
  const { core } = state;
  const board =
    def.problem === undefined ? null : (
      <ProblemCard
        problem={def.problem}
        dots={core.hintLevel >= 1}
        answer={core.solved ? def.answer : undefined}
      />
    );
  const controls = (
    <>
      <ExerciseControls
        showHint={showHint}
        onHint={() => {
          dispatch({ type: 'hint' });
        }}
      />
      <EntryDisplay entry={core.entry} wrongValue={state.wrongValue} />
      <NumberPad
        canCheck={core.entry !== ''}
        onDigit={(digit) => {
          dispatch({ type: 'enter-digit', digit });
        }}
        onErase={() => {
          dispatch({ type: 'erase-digit' });
        }}
        onCheck={() => {
          dispatch({ type: 'submit-number' });
        }}
      />
    </>
  );
  return <ExerciseFrame board={board} panel={panelBody(top, core.solved, done, controls)} />;
}
