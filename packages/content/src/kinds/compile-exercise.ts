// Compiles one exercise, or an array of them — a lesson's `guided`/`exercises`/`variants`, or a
// `series` mini-game's `rounds` — through the exercise-kind registry.
import type { ExerciseDefBase } from '@chess-kids/core';
import type { ExerciseYamlBase, StimulusContent } from '../subject.ts';
import type { AnyExerciseKindContent } from './kind-content.ts';
import { makeCompileContext } from './kind-content.ts';

/** Compiles one exercise: compiles its stimulus (the subject's own head/tail, e.g. chess's position
 * + last move), then hands the rest to its own kind's `compile` through a `CompileContext` that
 * supplies the shared head and tail. */
export function compileExercise(
  relPath: string,
  fieldPath: string,
  raw: ExerciseYamlBase,
  concept: string,
  stimulus: StimulusContent,
  kinds: Readonly<Record<string, AnyExerciseKindContent>>,
  issues: string[],
): ExerciseDefBase | null {
  const where = `${relPath}: ${fieldPath}`;
  const compiledStimulus = stimulus.compile(raw, { where, issues });
  if (compiledStimulus === null) {
    return null;
  }
  const ctx = makeCompileContext(
    relPath,
    fieldPath,
    issues,
    { id: raw.id, concept, textKey: `lessons:${raw.text ?? raw.id}` },
    raw.easier,
    compiledStimulus,
  );
  return kinds[raw.type]?.compile(raw, ctx) ?? null;
}

/** Compiles an array of exercises; `null` (with issues pushed) if any of them failed. */
export function compileExercises(
  relPath: string,
  fieldPath: string,
  raw: readonly ExerciseYamlBase[],
  concept: string,
  stimulus: StimulusContent,
  kinds: Readonly<Record<string, AnyExerciseKindContent>>,
  issues: string[],
): readonly ExerciseDefBase[] | null {
  const compiled: ExerciseDefBase[] = [];
  let allOk = true;
  for (const [index, entry] of raw.entries()) {
    const exercise = compileExercise(
      relPath,
      `${fieldPath}[${String(index)}]`,
      entry,
      concept,
      stimulus,
      kinds,
      issues,
    );
    if (exercise === null) {
      allOk = false;
      continue;
    }
    compiled.push(exercise);
  }
  return allOk ? compiled : null;
}
