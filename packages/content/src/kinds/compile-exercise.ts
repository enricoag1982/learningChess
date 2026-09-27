/**
 * Compiles one exercise, or an array of them — a lesson's `guided`/`exercises`/`variants`, or a
 * `series` mini-game's `rounds` — through the exercise-kind registry. The one place either kind of
 * exercise list turns into `ExerciseDef[]`, so a mode's own compile (`modes/series/compile.ts`)
 * never repeats this.
 */
import { doubleStepBefore, type ExerciseDef, type Position, type Square } from '@chess-kids/core';
import { compilePosition } from './common.ts';
import { contentKindOf, type ExerciseYaml } from './index.ts';
import { makeCompileContext } from './kind-content.ts';

/** Parses `lastMove`'s `<from><to>` shape (`lesson-schema.ts`'s regex already restricted it). */
function parseLastMove(raw: string): { readonly from: Square; readonly to: Square } {
  return { from: raw.slice(0, 2) as Square, to: raw.slice(2, 4) as Square };
}

/**
 * Exercise field `lastMove` (M4.1, display only): checks it against `position` — a piece must sit
 * on `to` (something must have just moved there), and, when the position has an en passant square,
 * `lastMove` must be exactly the double step that produced it, so the board never shows the kid a
 * "last move" that could not have just happened.
 */
function checkLastMove(
  position: Position,
  lastMove: { readonly from: Square; readonly to: Square },
  where: string,
  issues: string[],
): void {
  if (position.pieces[lastMove.to] === undefined) {
    issues.push(`${where}: lastMove "${lastMove.from}${lastMove.to}": no piece on ${lastMove.to}`);
  }
  const ep = position.enPassant;
  if (ep === null) {
    return;
  }
  const expected = doubleStepBefore(ep);
  if (lastMove.from !== expected.from || lastMove.to !== expected.to) {
    issues.push(
      `${where}: lastMove "${lastMove.from}${lastMove.to}" is not the double step matching en ` +
        `passant square ${ep} (expected "${expected.from}${expected.to}")`,
    );
  }
}

/**
 * Compiles one exercise: parses its position and `lastMove` (shared by every kind), then hands the
 * rest to its own kind's `compile` (`kinds/<type>/compile.ts`, via `EXERCISE_KIND_CONTENT`) through
 * a `CompileContext` that supplies the head (`id`/`concept`/`textKey`/`position`) and tail
 * (`easier`/`lastMove`) every exercise shares.
 */
export function compileExercise(
  relPath: string,
  fieldPath: string,
  raw: ExerciseYaml,
  concept: string,
  issues: string[],
): ExerciseDef | null {
  const position = compilePosition(relPath, `${fieldPath}.board`, raw, issues);
  if (position === null) {
    return null;
  }
  let lastMove: { readonly from: Square; readonly to: Square } | undefined;
  if (raw.lastMove !== undefined) {
    lastMove = parseLastMove(raw.lastMove);
    checkLastMove(position, lastMove, `${relPath}: ${fieldPath}`, issues);
  }
  const ctx = makeCompileContext(
    relPath,
    fieldPath,
    issues,
    { id: raw.id, concept, textKey: `lessons:${raw.text}`, position },
    { easier: raw.easier, lastMove },
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
