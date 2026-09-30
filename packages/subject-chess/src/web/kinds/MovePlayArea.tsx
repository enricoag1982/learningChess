import type { JSX, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  BestMoveDef,
  CaptureDef,
  CollectStarsDef,
  MateInNDef,
} from '../../core/exercise/types.ts';
import type { ExerciseStateOf } from '../../core/exercise/state.ts';
import type { Hint } from '../../core/exercise/hint.ts';
import type { MoveAction } from '../../kinds/base.ts';
import type { UndoAction } from '../../kinds/static-move.ts';
import { chessWeb, checkSquareFor } from '../chess-pack.ts';
import { Svg } from '@learn/platform-web/ui/ds/icons.tsx';
import { INFO_CHIP } from '@learn/platform-web/ui/ds/primitives-styles.ts';
import { StarsRow } from '@learn/platform-web/ui/StarsRow.tsx';
import { SECONDARY_BUTTON } from '@learn/platform-web/ui/lesson/button-styles.ts';
import { ExerciseControls } from '@learn/platform-web/kinds/ExerciseControls.tsx';
import { ExerciseFrame } from '@learn/platform-web/kinds/ExercisePlay.tsx';
import { panelBody } from '@learn/platform-web/kinds/panel-body.tsx';
import type {
  ExerciseUIState,
  PlayAreaProps,
  SessionAction,
} from '@learn/platform-web/kinds/kind-ui.ts';
import type { MoveExtra } from './move-ui.ts';
import { moveKindLegalMoves } from './move-ui.ts';
import { MoveBoard } from './MoveBoard.tsx';

export const UndoIcon = (): JSX.Element => (
  <Svg size={26}>
    <path d="M9 14L4 9l5-5" />
    <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
  </Svg>
);

export interface MovesChipProps {
  readonly current: number;
  readonly target: number;
}

/** Moves-so-far counter (collect-stars / capture) as an inline chip in the action row: info, flat
 * (docs/screens.md §1), never a button. The target ("in 1 move") is read out, the stars show it. */
export function MovesChip({ current, target }: MovesChipProps): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className={`${INFO_CHIP} w-full @xl:w-auto`}>
      <span className="text-sm font-extrabold uppercase tracking-wide text-muted">
        {t('exercise.moves-label')}
      </span>
      <span className="font-semibold">{t('exercise.moves-of', { current, total: target })}</span>
      <StarsRow earned={3} max={3} size="1rem" />
      <span className="sr-only">{t('exercise.moves-target', { count: target })}</span>
    </div>
  );
}

type MoveDef = CollectStarsDef | CaptureDef | BestMoveDef | MateInNDef;

interface MovePlayAreaProps {
  readonly state: ExerciseUIState<MoveDef, ExerciseStateOf<MoveDef>, MoveExtra>;
  readonly dispatch: (action: SessionAction<MoveAction>) => void;
  readonly showHint: boolean;
  readonly showCheck: boolean;
  readonly top: ReactNode;
  readonly done: ReactNode | null;
  readonly actions?: ReactNode;
  readonly info?: ReactNode;
  readonly undo?: ReactNode;
}

export function MovePlayArea({
  state,
  dispatch,
  showHint,
  showCheck,
  top,
  done,
  actions,
  info,
  undo,
}: MovePlayAreaProps): JSX.Element {
  // While mate-in-n's reply is pending, the board shows the position right after the kid's own
  // move (not the reply, already applied in `state.core`) until `reveal` fires.
  const displayPosition = state.pending ? state.pending.state.position : state.core.position;

  const board = (
    <MoveBoard
      position={displayPosition}
      legalMoves={state.pending ? [] : moveKindLegalMoves(state.core, chessWeb.core.context)}
      onMove={(move) => {
        dispatch({ type: 'move', move });
      }}
      onTapFirst={() => {
        dispatch({ type: 'tap-first' });
      }}
      // `useExerciseSession` (generic) types `state.hint` by its base shape; the pack's own
      // registry narrows `def.type` to a chess kind at runtime, so this always is one.
      hint={state.hint as Hint | null}
      lastMove={state.lastMove}
      wrongMove={state.wrongMove}
      checkSquare={showCheck ? checkSquareFor(displayPosition) : undefined}
    />
  );

  const controls = (
    <ExerciseControls
      showHint={showHint}
      onHint={() => {
        dispatch({ type: 'hint' });
      }}
      info={info}
      slot={undo}
      extras={actions}
    />
  );

  return <ExerciseFrame board={board} panel={panelBody(top, state.core.solved, done, controls)} />;
}

export function CountedPlayArea(
  props: PlayAreaProps<
    CollectStarsDef | CaptureDef,
    ExerciseStateOf<CollectStarsDef | CaptureDef>,
    MoveAction | UndoAction,
    MoveExtra
  >,
): JSX.Element {
  const { t } = useTranslation();
  const { def, state, dispatch } = props;
  return (
    <MovePlayArea
      {...props}
      info={<MovesChip current={state.core.moves} target={def.stars3} />}
      undo={
        <button
          type="button"
          onClick={() => {
            dispatch({ type: 'undo' });
          }}
          className={SECONDARY_BUTTON}
        >
          <UndoIcon />
          {t('exercise.undo')}
        </button>
      }
    />
  );
}
