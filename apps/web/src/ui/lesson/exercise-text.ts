import type { TFunction } from 'i18next';
import type { ExerciseDef, Hint, PieceType, Stars } from '@chess-kids/core';
import { characterName, tContent } from '../../content-text.ts';
import { characterPiece } from '../art/character-meta.ts';
import type { SpeechBubbleNote } from '../SpeechBubble.tsx';
import type { ExerciseFeedback } from './exercise-reducer.ts';

/** The piece-specific "that's not how I move" line (docs/screens.md: errors are never red). */
function illegalMoveText(t: TFunction, piece: PieceType, name: string): string {
  switch (piece) {
    case 'r':
      return t('exercise.illegal.r', { name });
    case 'b':
      return t('exercise.illegal.b', { name });
    case 'q':
      return t('exercise.illegal.q', { name });
    case 'k':
      return t('exercise.illegal.k', { name });
    case 'n':
      return t('exercise.illegal.n', { name });
    case 'p':
      return t('exercise.illegal.p', { name });
  }
}

/** Praise line shown once an exercise is solved, picked by stars earned. */
function praiseText(t: TFunction, stars: Stars): string {
  if (stars >= 3) return t('exercise.praise-3');
  if (stars === 2) return t('exercise.praise-2');
  return t('exercise.praise-1');
}

/** The exercise's instruction: always shown, never replaced by a hint / error / praise note. */
export function exerciseInstructionText(t: TFunction, def: ExerciseDef): string {
  return tContent(t, def.textKey);
}

/** Hint-ladder text: shape (and so wording) depends on the exercise type (`hint.kind`). */
function hintNoteText(t: TFunction, hint: Hint, name: string): string {
  if (hint.kind === 'squares') {
    if (hint.level === 1) return t('exercise.hint-piece', { name });
    if (hint.level === 2) return t('exercise.hint-target');
    return t('exercise.hint-answer');
  }
  if (hint.kind === 'yes-no') {
    if (hint.level === 1) return t('exercise.hint-look');
    if (hint.level === 2) return t('exercise.hint-think-again');
    return t('exercise.hint-answer');
  }
  if (hint.kind === 'choice') {
    if (hint.level === 3) return t('exercise.hint-answer');
    return t('exercise.hint-remove-option');
  }
  // setup
  if (hint.level === 3 || hint.piece === undefined) return t('exercise.hint-answer');
  if (hint.level === 2 && hint.square !== undefined) return t('exercise.setup.hint-square');
  return t('exercise.setup.hint-piece', {
    color: t(`board.color.${hint.piece.color}`),
    piece: t(`board.piece.${hint.piece.type}`),
  });
}

/**
 * The note under the instruction for the current feedback, or `undefined` while just reading the
 * instruction (teaching-process.md §3.3: wrong move → explanation; hint ladder; praise on solve).
 */
export function exerciseNote(
  t: TFunction,
  feedback: ExerciseFeedback,
  character: string,
  stars: Stars,
): SpeechBubbleNote | undefined {
  const name = characterName(t, character);
  switch (feedback.kind) {
    case 'instruction':
      return undefined;
    case 'tap-first':
      return { text: t('exercise.tap-piece-first', { name }), tone: 'attention' };
    case 'illegal':
      return { text: illegalMoveText(t, characterPiece(character), name), tone: 'attention' };
    case 'select-wrong':
      return { text: t('exercise.select-wrong'), tone: 'attention' };
    case 'select-missing':
      return { text: t('exercise.select-missing'), tone: 'attention' };
    case 'wrong-answer':
      return { text: t('exercise.answer-wrong'), tone: 'attention' };
    case 'wrong-move':
      return { text: t('exercise.move-wrong'), tone: 'attention' };
    case 'wrong-placement':
      return { text: t('exercise.setup.wrong'), tone: 'attention' };
    case 'hint':
      return { text: hintNoteText(t, feedback.hint, name), tone: 'attention' };
    case 'solved':
      return { text: praiseText(t, stars), tone: 'praise' };
  }
}
