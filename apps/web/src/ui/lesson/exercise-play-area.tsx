import type { JSX } from 'react';
import type { TFunction } from 'i18next';
import type { ExerciseDef, Hint, MoveInput, Piece, Square, VariantRules } from '@chess-kids/core';
import { exerciseMoves, setupPalette } from '@chess-kids/core';
import { Board } from '../board/Board.tsx';
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from './button-styles.ts';
import { ChoiceOptions } from './ChoiceOptions.tsx';
import type { ExerciseAction, ExerciseUIState } from './exercise-reducer.ts';
import { HintIcon, MovesCard, UndoIcon } from './exercise-icons.tsx';
import { SetupPalette } from './SetupPalette.tsx';
import { YesNoButtons } from './YesNoButtons.tsx';

/** The board's `hint` ring squares, for the hint kinds that carry one (`squares` and `yes-no`). */
function hintSquares(hint: Hint | null): readonly Square[] | undefined {
  if (hint === null) return undefined;
  if (hint.kind === 'squares' || hint.kind === 'yes-no') return hint.squares;
  return undefined;
}

export interface ExercisePlayAreaProps {
  readonly t: TFunction;
  readonly rules: VariantRules;
  readonly exercise: ExerciseDef;
  readonly state: ExerciseUIState;
  readonly dispatch: (action: ExerciseAction) => void;
  /** setup only: the palette piece currently selected, waiting for a square tap. */
  readonly selectedPiece: Piece | null;
  readonly onSelectPiece: (piece: Piece | null) => void;
  /** Stacked layout (phone / iPad portrait, `GameLayout`'s `lg:` breakpoint): a `setup` exercise's
   * tray goes to `belowBoard` (directly under the board) instead of `controls` (M2.4 §2b). */
  readonly isStacked: boolean;
  /** The checked king's square right now, if any (Board's check ring, all exercise types). */
  readonly checkSquare?: Square;
  /** Hides the Hint button (domain-model.md §3.2: an assessment task offers no hints). Default `true`. */
  readonly showHint?: boolean;
  /** Animal-badge piece look (`board/piece-style.ts`), default `false` (classic only). */
  readonly pieceBadges?: boolean;
}

export interface ExercisePlayArea {
  readonly board: JSX.Element | null;
  /** Only for a `setup` exercise on a stacked layout; `null` otherwise. */
  readonly belowBoard: JSX.Element | null;
  readonly controls: JSX.Element;
}

/**
 * One exercise's board + input controls, of any exercise type — the part `ExerciseStep` and a
 * `series` boss's current round both need, built as a plain function (not a component) so neither
 * caller pays for an extra render layer. Callers own the reducer, the solved/not-solved framing,
 * autosave and the Next button; this only renders one round's play.
 */
export function buildExercisePlayArea({
  t,
  rules,
  exercise,
  state,
  dispatch,
  selectedPiece,
  onSelectPiece,
  isStacked,
  checkSquare,
  showHint = true,
  pieceBadges = false,
}: ExercisePlayAreaProps): ExercisePlayArea {
  const isSelectSquares = exercise.type === 'select-squares';
  const isMoveCounted = exercise.type === 'collect-stars' || exercise.type === 'capture';
  const checkHighlight = checkSquare === undefined ? {} : { check: checkSquare };

  function handleMove(move: MoveInput): void {
    dispatch({ type: 'move', move });
  }

  function handlePlace(square: Square, piece: Piece): void {
    dispatch({ type: 'place', square, piece });
    onSelectPiece(null);
  }

  let board: JSX.Element | null;
  if (isSelectSquares) {
    board = (
      <Board
        position={state.core.position}
        legalMoves={[]}
        onSquareTap={(square) => {
          dispatch({ type: 'toggle', square });
        }}
        highlights={{
          selectedSquares: state.core.selected,
          wrong: state.wrongSquares.filter((square) => state.core.selected.includes(square)),
          missed: state.missedSquares.filter((square) => !state.core.selected.includes(square)),
          ...(hintSquares(state.hint) ? { hint: hintSquares(state.hint) } : {}),
          ...checkHighlight,
        }}
        label={t('lesson.board-label')}
        pieceBadges={pieceBadges}
      />
    );
  } else if (exercise.type === 'yes-no') {
    board = (
      <Board
        position={state.core.position}
        legalMoves={[]}
        highlights={{
          focus: exercise.focus ? [exercise.focus] : [],
          ...(hintSquares(state.hint) ? { hint: hintSquares(state.hint) } : {}),
          ...(state.lastMove ? { lastMove: state.lastMove } : {}),
          ...checkHighlight,
        }}
        label={t('lesson.board-label')}
        pieceBadges={pieceBadges}
      />
    );
  } else if (exercise.type === 'choice') {
    board = exercise.showBoard ? (
      <Board
        position={state.core.position}
        legalMoves={[]}
        highlights={checkHighlight}
        label={t('lesson.board-label')}
        pieceBadges={pieceBadges}
      />
    ) : null;
  } else if (exercise.type === 'best-move') {
    board = (
      <Board
        position={state.core.position}
        legalMoves={exerciseMoves(state.core, rules)}
        onMove={({ from, to }) => {
          handleMove({ from, to });
        }}
        onIllegal={(attempt) => {
          if (attempt.from === null) {
            dispatch({ type: 'tap-first' });
          } else {
            handleMove({ from: attempt.from, to: attempt.to });
          }
        }}
        highlights={{
          ...(hintSquares(state.hint) ? { hint: hintSquares(state.hint) } : {}),
          ...(state.lastMove ? { lastMove: state.lastMove } : {}),
          ...(state.wrongMove ? { wrongMove: state.wrongMove } : {}),
          ...checkHighlight,
        }}
        label={t('lesson.board-label')}
        pieceBadges={pieceBadges}
      />
    );
  } else if (exercise.type === 'setup') {
    const setupHint = state.hint?.kind === 'setup' ? state.hint : null;
    board = (
      <Board
        position={state.core.position}
        legalMoves={[]}
        onSquareTap={(square) => {
          if (selectedPiece) handlePlace(square, selectedPiece);
        }}
        highlights={{
          wrong: state.wrongSquares,
          ...(setupHint?.square ? { hint: [setupHint.square] } : {}),
          ...checkHighlight,
        }}
        label={t('lesson.board-label')}
        pieceBadges={pieceBadges}
      />
    );
  } else if (exercise.type === 'mate-in-n') {
    // While the scripted reply is pending, the board keeps showing the position right after the
    // kid's own move (not the reply, already applied in `state.core`) — and stays uninteractive —
    // until `exercise-reducer.ts`'s `reveal-reply` fires, ~600ms later (150ms, reduced motion).
    const displayPosition = state.pendingReply ? state.pendingReply.position : state.core.position;
    const lastMoveHighlight = state.pendingReply
      ? { from: state.pendingReply.move.from, to: state.pendingReply.move.to }
      : state.lastMove;
    board = (
      <Board
        position={displayPosition}
        legalMoves={state.pendingReply ? [] : exerciseMoves(state.core, rules)}
        onMove={({ from, to }) => {
          handleMove({ from, to });
        }}
        onIllegal={(attempt) => {
          if (attempt.from === null) {
            dispatch({ type: 'tap-first' });
          } else {
            handleMove({ from: attempt.from, to: attempt.to });
          }
        }}
        highlights={{
          ...(hintSquares(state.hint) ? { hint: hintSquares(state.hint) } : {}),
          ...(lastMoveHighlight ? { lastMove: lastMoveHighlight } : {}),
          ...(state.wrongMove ? { wrongMove: state.wrongMove } : {}),
          ...checkHighlight,
        }}
        label={t('lesson.board-label')}
        pieceBadges={pieceBadges}
      />
    );
  } else {
    board = (
      <Board
        position={state.core.position}
        legalMoves={exerciseMoves(state.core, rules)}
        onMove={({ from, to }) => {
          handleMove({ from, to });
        }}
        onIllegal={(attempt) => {
          if (attempt.from === null) {
            dispatch({ type: 'tap-first' });
          } else {
            handleMove({ from: attempt.from, to: attempt.to });
          }
        }}
        highlights={{
          ...(hintSquares(state.hint) ? { hint: hintSquares(state.hint) } : {}),
          ...(state.lastMove ? { lastMove: state.lastMove } : {}),
          ...checkHighlight,
        }}
        label={t('lesson.board-label')}
        pieceBadges={pieceBadges}
      />
    );
  }

  const setupTray =
    exercise.type === 'setup' ? (
      <SetupPalette
        palette={setupPalette(state.core)}
        selected={selectedPiece}
        hint={state.hint}
        onSelect={onSelectPiece}
        compact={isStacked}
      />
    ) : null;

  const controls = (
    <>
      {isMoveCounted && <MovesCard t={t} current={state.core.moves} target={exercise.stars3} />}
      <div className="flex gap-3">
        {showHint && (
          <button
            type="button"
            onClick={() => {
              dispatch({ type: 'hint' });
            }}
            className={SECONDARY_BUTTON}
          >
            <HintIcon />
            {t('exercise.hint')}
          </button>
        )}
        {isSelectSquares && (
          <button
            type="button"
            onClick={() => {
              dispatch({ type: 'submit' });
            }}
            className={PRIMARY_BUTTON}
          >
            {t('exercise.check')}
          </button>
        )}
        {isMoveCounted && (
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
        )}
      </div>
      {exercise.type === 'yes-no' && (
        <YesNoButtons
          wrongValue={state.wrongAnswer}
          onAnswer={(value) => {
            dispatch({ type: 'answer-yes-no', value });
          }}
        />
      )}
      {exercise.type === 'choice' && (
        <ChoiceOptions
          options={exercise.options}
          wrongOptionIds={state.core.wrongOptions ?? []}
          onPick={(optionId) => {
            dispatch({ type: 'answer-choice', optionId });
          }}
        />
      )}
      {exercise.type === 'setup' && !isStacked && setupTray}
    </>
  );

  return {
    board,
    belowBoard: exercise.type === 'setup' && isStacked ? setupTray : null,
    controls,
  };
}
