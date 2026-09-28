import type { JSX, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  CaptureDef,
  CollectStarsDef,
  MoveAction,
  Square,
  UndoAction,
} from '@chess-kids/core/chess';
import { chessWeb } from '../chess-pack.ts';
import { InfoPanel } from '../ui/ds/primitives.tsx';
import { StarsRow } from '../ui/StarsRow.tsx';
import { SECONDARY_BUTTON } from '../ui/lesson/button-styles.ts';
import { ExerciseControls } from './ExerciseControls.tsx';
import { ExerciseFrame } from './ExercisePlay.tsx';
import { panelBody } from './panel-body.tsx';
import type { ExerciseUIState, UiAction } from './kind-ui.ts';
import { moveKindLegalMoves } from './kind-ui.ts';
import { MoveBoard } from './MoveBoard.tsx';

/** Shared with `VersusStep`'s take-back button — the one place a move-counted "undo" icon lives. */
export function UndoIcon(): JSX.Element {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 14L4 9l5-5" />
      <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
    </svg>
  );
}

export interface MovesCardProps {
  readonly current: number;
  readonly target: number;
}

/** Moves-so-far counter for a move-counted exercise (collect-stars / capture) — info, flat
 * (docs/screens.md §1): read-only, never a button. */
export function MovesCard({ current, target }: MovesCardProps): JSX.Element {
  const { t } = useTranslation();
  return (
    <InfoPanel className="flex flex-col gap-2 rounded-3xl px-5 py-4">
      <span className="text-xs font-extrabold uppercase tracking-wide text-muted sm:text-sm">
        {t('exercise.moves-label')}
      </span>
      <span className="font-display text-3xl font-semibold text-ink">
        {t('exercise.moves-of', { current, total: target })}
      </span>
      <div className="flex items-center gap-2 text-sm font-bold text-muted">
        <StarsRow earned={3} max={3} size="1.1rem" />
        {t('exercise.moves-target', { count: target })}
      </div>
    </InfoPanel>
  );
}

export interface MoveCountedPlayAreaProps {
  readonly def: CollectStarsDef | CaptureDef;
  readonly state: ExerciseUIState<CollectStarsDef | CaptureDef>;
  readonly dispatch: (action: MoveAction | UndoAction | UiAction) => void;
  readonly checkSquare?: Square;
  readonly showHint: boolean;
  readonly pieceBadges: boolean;
  readonly top: ReactNode;
  readonly done: ReactNode | null;
}

/** collect-stars / capture's shared play area — the only difference between the two kinds is the
 * goal already folded into `state.core` (`solve`d star collection vs. captures); the UI is the
 * same: move-count card, board, Hint + Undo. */
export function MoveCountedPlayArea({
  def,
  state,
  dispatch,
  checkSquare,
  showHint,
  pieceBadges,
  top,
  done,
}: MoveCountedPlayAreaProps): JSX.Element {
  const { t } = useTranslation();
  const solved = state.core.solved;

  const board = (
    <MoveBoard
      position={state.core.position}
      legalMoves={moveKindLegalMoves(state.core, chessWeb.core.context)}
      onMove={(move) => {
        dispatch({ type: 'move', move });
      }}
      onTapFirst={() => {
        dispatch({ type: 'tap-first' });
      }}
      hint={state.hint}
      lastMove={state.lastMove}
      checkSquare={checkSquare}
      pieceBadges={pieceBadges}
    />
  );

  const controls = (
    <>
      <MovesCard current={state.core.moves} target={def.stars3} />
      <ExerciseControls
        showHint={showHint}
        onHint={() => {
          dispatch({ type: 'hint' });
        }}
        slot={
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
    </>
  );

  return <ExerciseFrame board={board} panel={panelBody(top, solved, done, controls)} />;
}
