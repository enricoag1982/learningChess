import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import type { ActionOf, DefOf, ExerciseStateOf } from '../../chess.ts';
import { checkSquareFor, useSurfacePieceBadges } from '../../web/chess-pack.ts';
import { Board } from '../../web/ui/board/Board.tsx';
import { ExerciseControls } from '@learn/platform-web/kinds/ExerciseControls.tsx';
import { ExerciseFrame } from '@learn/platform-web/kinds/ExercisePlay.tsx';
import { panelBody } from '@learn/platform-web/kinds/panel-body.tsx';
import type { PlayAreaProps } from '@learn/platform-web/kinds/kind-ui.ts';
import type { WrongSquaresExtra } from '../../web/kinds/move-ui.ts';
import { ChoiceOptions } from './ChoiceOptions.tsx';

export function PlayArea({
  def,
  state,
  dispatch,
  showHint,
  showCheck,
  surface,
  top,
  done,
}: PlayAreaProps<
  DefOf<'choice'>,
  ExerciseStateOf<DefOf<'choice'>>,
  ActionOf<'choice'>,
  WrongSquaresExtra
>): JSX.Element {
  const { t } = useTranslation();
  const pieceBadges = useSurfacePieceBadges(surface);
  const solved = state.core.solved;
  const checkSquare = showCheck ? checkSquareFor(state.core.position) : undefined;

  // A choice exercise's board is opt-in (`def.showBoard`) — `ExerciseFrame` gives a hidden board
  // the panel's full width instead of leaving an empty board-shaped gap.
  const board = def.showBoard ? (
    <Board
      position={state.core.position}
      legalMoves={[]}
      highlights={checkSquare === undefined ? {} : { check: checkSquare }}
      label={t('lesson.board-label')}
      pieceBadges={pieceBadges}
    />
  ) : null;

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
      />
    </>
  );

  return <ExerciseFrame board={board} panel={panelBody(top, solved, done, controls)} />;
}
