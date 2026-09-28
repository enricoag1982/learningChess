// Compiles one exercise, or an array of them — a lesson's `guided`/`exercises`/`variants`, or a
// `series` mini-game's `rounds` — through the exercise-kind registry.
import type { ExerciseDef } from '@chess-kids/core/chess';
import { chessStimulus } from '../chess-content.ts';
import { contentKindOf, type ExerciseYaml } from './index.ts';
import { makeCompileContext } from './kind-content.ts';

/** Compiles one exercise: compiles its stimulus (chess: position + last move), then hands the rest
 * to its own kind's `compile` through a `CompileContext` that supplies the shared head and tail. */
export function compileExercise(
  relPath: string,
  fieldPath: string,
  raw: ExerciseYaml,
  concept: string,
  issues: string[],
): ExerciseDef | null {
  const where = `${relPath}: ${fieldPath}`;
  const stimulus = chessStimulus.compile(raw, { where, issues });
  if (stimulus === null) {
    return null;
  }
  const ctx = makeCompileContext(
    relPath,
    fieldPath,
    issues,
    { id: raw.id, concept, textKey: `lessons:${raw.text ?? raw.id}` },
    raw.easier,
    stimulus,
  );
  return contentKindOf(raw.type).compile(raw, ctx);
}

/** Compiles an array of exercises; `null` (with issues pushed) if any of them failed. */
export function compileExercises(
  relPath: string,
  fieldPath: string,
  raw: readonly ExerciseYaml[],
  concept: string,
  issues: string[],
): readonly ExerciseDef[] | null {
  const compiled: ExerciseDef[] = [];
  let allOk = true;
  for (const [index, entry] of raw.entries()) {
    const exercise = compileExercise(
      relPath,
      `${fieldPath}[${String(index)}]`,
      entry,
      concept,
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
