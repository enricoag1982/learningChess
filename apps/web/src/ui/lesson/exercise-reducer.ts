import type {
  ExerciseDef,
  ExerciseState,
  Hint,
  Move,
  MoveInput,
  Piece,
  Position,
  Square,
  VariantRules,
} from '@chess-kids/core';
import {
  answerChoice,
  answerYesNo,
  chessJsRules,
  placePiece,
  playMateInN,
  playMove,
  requestHint,
  startExercise,
  submitSelection,
  toggleSquare,
  undo,
} from '@chess-kids/core';

/** What the Owl bubble should say right now; resolved to text by the component (i18n lives there). */
export type ExerciseFeedback =
  | { readonly kind: 'instruction' }
  | { readonly kind: 'tap-first' }
  | { readonly kind: 'illegal' }
  | { readonly kind: 'select-wrong' }
  | { readonly kind: 'select-missing' }
  /** yes-no / choice: a wrong pick. */
  | { readonly kind: 'wrong-answer' }
  /** best-move: a legal move that is not in `solutions`. */
  | { readonly kind: 'wrong-move' }
  /** setup: a piece placed on the wrong square (or an already-filled one). */
  | { readonly kind: 'wrong-placement' }
  | { readonly kind: 'hint'; readonly hint: Hint }
  | { readonly kind: 'solved' }
  /** mate-in-n: delivered checkmate (any mating move, not only the scripted one). */
  | { readonly kind: 'checkmate' }
  /** mate-in-n: the scripted opponent reply, revealed after its short delay. */
  | { readonly kind: 'opponent-reply'; readonly reply: Move };

export interface ExerciseUIState {
  readonly core: ExerciseState;
  /** Current hint highlight, if any (cleared by a move/toggle/submit/undo). */
  readonly hint: Hint | null;
  readonly feedback: ExerciseFeedback;
  /** Squares wrongly selected/placed in the last try; orange, never red. */
  readonly wrongSquares: readonly Square[];
  /** The last played kid move, for the board's slide animation (collect-stars / capture / best-move). */
  readonly lastMove?: { readonly from: Square; readonly to: Square };
  /** best-move: a legal-but-wrong attempt, for the board's slide-and-bounce-back animation. */
  readonly wrongMove?: { readonly from: Square; readonly to: Square };
  /** yes-no: the value last picked wrong, if any — that button turns orange and disables. */
  readonly wrongAnswer?: boolean;
  /**
   * mate-in-n only: the kid's move was accepted and its scripted opponent reply already applied
   * in `core`, but not shown yet — `position` is the board right after the kid's own move (before
   * the reply), for the board to render while the reply's short delay plays out.
   */
  readonly pendingReply?: {
    readonly move: Move;
    readonly reply: Move;
    readonly position: Position;
  };
}

export type ExerciseAction =
  | { readonly type: 'move'; readonly move: MoveInput }
  | { readonly type: 'tap-first' }
  | { readonly type: 'toggle'; readonly square: Square }
  | { readonly type: 'submit' }
  | { readonly type: 'answer-yes-no'; readonly value: boolean }
  | { readonly type: 'answer-choice'; readonly optionId: string }
  | { readonly type: 'place'; readonly square: Square; readonly piece: Piece }
  | { readonly type: 'hint' }
  /** Guided tries pre-show hint level 1 on mount; unlike 'hint', this leaves feedback untouched. */
  | { readonly type: 'auto-hint' }
  | { readonly type: 'undo' }
  /** mate-in-n: reveals the scripted opponent reply once its short delay has elapsed. */
  | { readonly type: 'reveal-reply' };

/** Fresh reducer state for a newly-started exercise (guided or scored). */
export function initExerciseState(def: ExerciseDef): ExerciseUIState {
  return {
    core: startExercise(def),
    hint: null,
    feedback: { kind: 'instruction' },
    wrongSquares: [],
  };
}

/** Builds the reducer bound to `rules` (stable for the app's lifetime; never changes mid-exercise). */
export function createExerciseReducer(
  rules: VariantRules,
): (state: ExerciseUIState, action: ExerciseAction) => ExerciseUIState {
  return function exerciseReducer(state, action) {
    switch (action.type) {
      case 'move': {
        if (state.core.def.type === 'mate-in-n') {
          if (state.pendingReply) {
            // The scripted reply has not been shown yet: ignore input until it is.
            return state;
          }
          const { state: core, outcome } = playMateInN(state.core, chessJsRules, action.move);
          if (outcome.kind === 'illegal') {
            return {
              ...state,
              core,
              hint: null,
              feedback: { kind: 'illegal' },
              wrongSquares: [],
              wrongMove: undefined,
              pendingReply: undefined,
            };
          }
          if (outcome.kind === 'wrong') {
            return {
              ...state,
              core,
              hint: null,
              feedback: { kind: 'wrong-move' },
              wrongSquares: [],
              wrongMove: { from: outcome.move.from, to: outcome.move.to },
              pendingReply: undefined,
            };
          }
          if (outcome.kind === 'solved') {
            return {
              ...state,
              core,
              hint: null,
              feedback: { kind: 'checkmate' },
              wrongSquares: [],
              wrongMove: undefined,
              lastMove: { from: outcome.move.from, to: outcome.move.to },
              pendingReply: undefined,
            };
          }
          // 'moved': the scripted reply is already applied in `core`; stage it for its delayed
          // reveal. `core.history`'s last entry is the position right after the kid's own move
          // (before the reply), pushed by `playMateInN` alongside the pre-move one.
          const positionAfterMove = core.history[core.history.length - 1];
          if (positionAfterMove === undefined) {
            throw new Error(
              'exercise-reducer: mate-in-n history is missing the pre-reply position',
            );
          }
          return {
            ...state,
            core,
            hint: null,
            feedback: { kind: 'instruction' },
            wrongSquares: [],
            wrongMove: undefined,
            lastMove: { from: outcome.move.from, to: outcome.move.to },
            pendingReply: { move: outcome.move, reply: outcome.reply, position: positionAfterMove },
          };
        }
        const { state: core, outcome } = playMove(state.core, rules, action.move);
        if (outcome.kind === 'illegal') {
          return {
            ...state,
            core,
            hint: null,
            feedback: { kind: 'illegal' },
            wrongSquares: [],
            wrongMove: undefined,
          };
        }
        if (outcome.kind === 'wrong') {
          return {
            ...state,
            core,
            hint: null,
            feedback: { kind: 'wrong-move' },
            wrongSquares: [],
            wrongMove: { from: outcome.move.from, to: outcome.move.to },
          };
        }
        return {
          ...state,
          core,
          hint: null,
          feedback: outcome.kind === 'solved' ? { kind: 'solved' } : { kind: 'instruction' },
          wrongSquares: [],
          wrongMove: undefined,
          lastMove: { from: outcome.move.from, to: outcome.move.to },
        };
      }
      case 'tap-first':
        return { ...state, feedback: { kind: 'tap-first' } };
      case 'toggle':
        return {
          ...state,
          core: toggleSquare(state.core, action.square),
          feedback: { kind: 'instruction' },
          wrongSquares: [],
        };
      case 'submit': {
        const { state: core, result } = submitSelection(state.core, rules);
        if (result.correct) {
          return { ...state, core, hint: null, feedback: { kind: 'solved' }, wrongSquares: [] };
        }
        const onlyMissing = result.wrong.length === 0 && result.missing > 0;
        return {
          ...state,
          core,
          feedback: { kind: onlyMissing ? 'select-missing' : 'select-wrong' },
          wrongSquares: onlyMissing ? [] : result.wrong,
        };
      }
      case 'answer-yes-no': {
        const core = answerYesNo(state.core, action.value);
        return {
          ...state,
          core,
          hint: null,
          feedback: core.solved ? { kind: 'solved' } : { kind: 'wrong-answer' },
          wrongSquares: [],
          wrongAnswer: core.solved ? undefined : action.value,
        };
      }
      case 'answer-choice': {
        const core = answerChoice(state.core, action.optionId);
        return {
          ...state,
          core,
          hint: null,
          feedback: core.solved ? { kind: 'solved' } : { kind: 'wrong-answer' },
          wrongSquares: [],
        };
      }
      case 'place': {
        const { state: core, outcome } = placePiece(state.core, action.square, action.piece);
        const wrong = outcome.kind === 'wrong';
        return {
          ...state,
          core,
          hint: null,
          feedback:
            outcome.kind === 'solved'
              ? { kind: 'solved' }
              : wrong
                ? { kind: 'wrong-placement' }
                : { kind: 'instruction' },
          wrongSquares: wrong ? [action.square] : [],
        };
      }
      case 'hint': {
        const { state: core, hint } = requestHint(state.core, rules);
        return {
          ...state,
          core,
          hint,
          feedback: { kind: 'hint', hint },
          wrongSquares: [],
        };
      }
      case 'auto-hint': {
        const { state: core, hint } = requestHint(state.core, rules);
        return { ...state, core, hint };
      }
      case 'reveal-reply': {
        if (!state.pendingReply) {
          return state;
        }
        const { reply } = state.pendingReply;
        return {
          ...state,
          pendingReply: undefined,
          lastMove: { from: reply.from, to: reply.to },
          feedback: { kind: 'opponent-reply', reply },
        };
      }
      case 'undo':
        return {
          ...state,
          core: undo(state.core),
          hint: null,
          feedback: { kind: 'instruction' },
          wrongSquares: [],
          lastMove: undefined,
        };
    }
  };
}
