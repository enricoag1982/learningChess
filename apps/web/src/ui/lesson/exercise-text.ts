import type { TFunction } from 'i18next';
import type { ExerciseDef, PieceType, Stars } from '@chess-kids/core';
import { characterName, tContent } from '../../content-text.ts';
import { characterPiece } from '../art/character-meta.ts';
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

/** Resolves the Owl bubble's current line for an exercise step. */
export function exerciseBubbleText(
  t: TFunction,
  feedback: ExerciseFeedback,
  def: ExerciseDef,
  character: string,
  stars: Stars,
): string {
  const name = characterName(t, character);
  switch (feedback.kind) {
    case 'instruction':
      return tContent(t, def.textKey);
    case 'tap-first':
      return t('exercise.tap-piece-first', { name });
    case 'illegal':
      return illegalMoveText(t, characterPiece(character), name);
    case 'select-wrong':
      return t('exercise.select-wrong');
    case 'select-missing':
      return t('exercise.select-missing');
    case 'hint':
      if (feedback.level === 1) return t('exercise.hint-piece', { name });
      if (feedback.level === 2) return t('exercise.hint-target');
      return t('exercise.hint-answer');
    case 'solved':
      return praiseText(t, stars);
  }
}
