/**
 * Every compiled exercise, whichever kind, proves two things about its own kind's action
 * sequences: `wrongAction` costs exactly 1 error and never blocks solving, and `solution` reaches a
 * clean (3-star) solve from a fresh state.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CompiledContent } from '../core/chess/lesson.ts';
import type { ExerciseDef } from '../core/exercise/types.ts';
import { kindOf } from '../kinds/index.ts';
import { playSolution, playWrongThenSolve } from '../testing/index.ts';
import { describe, expect, it } from 'vitest';
import { chessContent } from './chess-content.ts';
import { loadLocales, mergeLocales } from '@learn/platform-content/load';
import { loadContent } from '@learn/platform-content/lesson-load';
import { PLATFORM_LOCALES_DIR } from '@learn/platform-content/paths';

const packageDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'content');
const locales = mergeLocales(
  loadLocales(PLATFORM_LOCALES_DIR),
  loadLocales(join(packageDir, 'locales')),
);
const content = loadContent<CompiledContent>(
  join(packageDir, 'lessons'),
  join(packageDir, 'minigames'),
  locales,
  chessContent,
);

function allExercises(): readonly { readonly where: string; readonly exercise: ExerciseDef }[] {
  const all: { readonly where: string; readonly exercise: ExerciseDef }[] = [];
  for (const lesson of content.lessons) {
    for (const exercise of [...lesson.guided, ...lesson.exercises, ...(lesson.variants ?? [])]) {
      all.push({ where: `${lesson.id}/${exercise.id}`, exercise });
    }
  }
  for (const minigame of content.minigames) {
    if (minigame.mode !== 'series') continue;
    for (const round of minigame.rounds) {
      all.push({ where: `${minigame.id}/${round.id}`, exercise: round });
    }
  }
  return all;
}

describe.each(allExercises())('$where ($exercise.type)', ({ exercise }) => {
  it('solution() solves cleanly from a fresh state, with 3 stars', () => {
    const solved = playSolution(exercise);
    expect(solved.solved).toBe(true);
    expect(kindOf(exercise).stars(solved)).toBe(3);
  });

  it('wrongAction() costs exactly 1 error and does not block solving', () => {
    const result = playWrongThenSolve(exercise);
    expect(result.errors).toBe(1);
    expect(result.solved).toBe(true);
  });
});
