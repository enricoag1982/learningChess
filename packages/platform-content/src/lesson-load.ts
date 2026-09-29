import { statSync } from 'node:fs';
import { join } from 'node:path';
import type { CompiledContent, ExerciseDefBase, Lesson, MiniGame } from '@learn/platform-core';
import { compileExercises } from './kinds/compile-exercise.ts';
import { createLessonSchemas } from './lesson-schema.ts';
import { checkTextKey, ContentError, type Locales } from './load.ts';
import { makeMiniGameCompileContext, type ModeVerifyContext } from './modes/mode-content.ts';
import type { SubjectContent } from './subject.ts';
import { loadYaml, readEntries } from './yaml-file.ts';

type LessonSchemas = ReturnType<typeof createLessonSchemas>;

function compileLessonFile(
  filePath: string,
  relPath: string,
  worldName: string,
  content: SubjectContent,
  schemas: LessonSchemas,
  issues: string[],
): Lesson | null {
  const loaded = loadYaml(filePath, relPath, schemas.lessonSchema);
  if ('issues' in loaded) {
    issues.push(...loaded.issues);
    return null;
  }
  const data = loaded.data;

  const demo = content.demo.compile(data.demo, `lessons:${data.demo.text ?? `${data.id}.demo`}`, {
    where: `${relPath}: demo`,
    issues,
  });
  const guided = compileExercises(
    relPath,
    'guided',
    data.guided,
    data.concept,
    content.stimulus,
    content.kinds,
    issues,
  );
  const exercises = compileExercises(
    relPath,
    'exercises',
    data.exercises,
    data.concept,
    content.stimulus,
    content.kinds,
    issues,
  );
  const variants = compileExercises(
    relPath,
    'variants',
    data.variants ?? [],
    data.concept,
    content.stimulus,
    content.kinds,
    issues,
  );
  if (demo === null || guided === null || exercises === null || variants === null) {
    return null;
  }

  return {
    id: data.id,
    world: data.world ?? worldName,
    order: data.order,
    concept: data.concept,
    character: data.character,
    titleKey: `lessons:${data.title ?? `${data.id}.title`}`,
    storyKey: `lessons:${data.story ?? `${data.id}.story`}`,
    demo,
    guided,
    exercises,
    ...(variants.length > 0 ? { variants } : {}),
    ...(data.boss === undefined ? {} : { boss: data.boss }),
  };
}

/** Compiles one mini-game file: schema-validates it, then hands it to its own mode's `compile`
 * through a `MiniGameCompileContext` (board/FEN parsing, `series`' own exercise-array compiling). */
function compileMiniGameFile(
  filePath: string,
  relPath: string,
  content: SubjectContent,
  schemas: LessonSchemas,
  issues: string[],
): MiniGame | null {
  const loaded = loadYaml(filePath, relPath, schemas.miniGameSchema);
  if ('issues' in loaded) {
    issues.push(...loaded.issues);
    return null;
  }
  const data = loaded.data;

  const ctx = makeMiniGameCompileContext(relPath, content.kinds, content.stimulus, issues);
  const mode = data.mode ?? 'static';
  return content.modes[mode]?.compile(data, ctx) ?? null;
}

/** Per-exercise semantic checks, shared by a lesson's guided/exercises/variants and a series
 * mini-game's rounds: the instruction text key resolves, the subject's own stimulus check passes
 * unless this kind says otherwise, every extra text key the kind reports resolves too, and the
 * kind's own `verify`. */
function checkExerciseSemantics(
  exercise: ExerciseDefBase,
  where: string,
  locales: Locales,
  content: SubjectContent,
  issues: string[],
): void {
  checkTextKey(exercise.textKey, locales, where, issues);
  const kind = content.kinds[exercise.type];
  if (kind?.needsKidPiece?.(exercise) ?? true) {
    content.stimulus.check?.(exercise, { where, issues });
  }
  for (const ref of kind?.textKeys?.(exercise) ?? []) {
    checkTextKey(ref.key, locales, `${where}: ${ref.label}`, issues);
  }
  kind?.verify?.(exercise, where, issues);
}

/** Per-lesson `easier`/`variants` rules: `easier` only on a scored exercise, referencing a variant
 * id of the same lesson; a variant has no `easier` of its own; every variant is referenced. */
function checkEasierVariants(lesson: Lesson, where: string, issues: string[]): void {
  const variants = lesson.variants ?? [];
  const variantIds = new Set(variants.map((variant) => variant.id));
  const referenced = new Set<string>();

  for (const exercise of lesson.guided) {
    if (exercise.easier !== undefined) {
      issues.push(`${where}: ${exercise.id}: easier is only for scored exercises`);
    }
  }
  for (const exercise of lesson.exercises) {
    if (exercise.easier === undefined) {
      continue;
    }
    if (!variantIds.has(exercise.easier)) {
      issues.push(
        `${where}: ${exercise.id}: easier references unknown variant "${exercise.easier}" (must be in this lesson's variants)`,
      );
      continue;
    }
    referenced.add(exercise.easier);
  }
  for (const variant of variants) {
    if (variant.easier !== undefined) {
      issues.push(`${where}: ${variant.id}: a variant cannot have its own easier`);
    }
    if (!referenced.has(variant.id)) {
      issues.push(`${where}: ${variant.id}: variant is not referenced by any exercise's easier`);
    }
  }
}

function validateSemantics(
  lessons: readonly Lesson[],
  minigames: readonly MiniGame[],
  locales: Locales,
  content: SubjectContent,
  issues: string[],
): void {
  const claimedIds = new Map<string, string>();
  const claimId = (id: string, where: string): void => {
    const claimedAt = claimedIds.get(id);
    if (claimedAt !== undefined) {
      issues.push(`${where}: duplicate id "${id}" (already used at ${claimedAt})`);
      return;
    }
    claimedIds.set(id, where);
  };

  const lessonIds = new Set(lessons.map((lesson) => lesson.id));
  const minigameIds = new Set(minigames.map((minigame) => minigame.id));

  for (const lesson of lessons) {
    const lessonWhere = `lessons/${lesson.world}/${lesson.id}.yaml`;
    claimId(lesson.id, lessonWhere);
    checkTextKey(lesson.titleKey, locales, `${lessonWhere}: title`, issues);
    checkTextKey(lesson.storyKey, locales, `${lessonWhere}: story`, issues);
    checkTextKey(
      `characters:${lesson.character}.name`,
      locales,
      `${lessonWhere}: character`,
      issues,
    );
    checkTextKey(lesson.demo.textKey, locales, `${lessonWhere}: demo.text`, issues);
    content.demo.check?.(lesson.demo, { where: `${lessonWhere}: demo`, issues });

    for (const exercise of [...lesson.guided, ...lesson.exercises, ...(lesson.variants ?? [])]) {
      const exerciseWhere = `${lessonWhere}: ${exercise.id}`;
      claimId(exercise.id, exerciseWhere);
      checkExerciseSemantics(exercise, exerciseWhere, locales, content, issues);
    }

    if (lesson.boss !== undefined && !minigameIds.has(lesson.boss)) {
      issues.push(`${lessonWhere}: boss references unknown mini-game "${lesson.boss}"`);
    }

    checkEasierVariants(lesson, lessonWhere, issues);
  }

  const modeVerifyCtx: ModeVerifyContext = {
    issues,
    claimId,
    checkExercise: (exercise, where) => {
      checkExerciseSemantics(exercise, where, locales, content, issues);
    },
  };

  for (const minigame of minigames) {
    const where = `minigames/${minigame.id}.yaml`;
    claimId(minigame.id, where);
    checkTextKey(minigame.titleKey, locales, `${where}: title`, issues);
    checkTextKey(minigame.goalKey, locales, `${where}: goal`, issues);
    if (!lessonIds.has(minigame.unlockAfter)) {
      issues.push(`${where}: unlockAfter references unknown lesson "${minigame.unlockAfter}"`);
    }
    content.modes[minigame.mode]?.verify(minigame, where, modeVerifyCtx);
  }
}

/** Loads and validates every lesson and mini-game file, compiling them to `C` (the caller's own
 * concrete content bundle, inferred from its declared return type). Collects every issue before
 * throwing a single `ContentError`. */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- see above.
export function loadContent<C extends CompiledContent = CompiledContent>(
  lessonsDir: string,
  minigamesDir: string,
  locales: Locales,
  content: SubjectContent,
): C {
  const issues: string[] = [];
  const lessons: Lesson[] = [];
  const minigames: MiniGame[] = [];
  const schemas = createLessonSchemas(content);

  for (const worldName of readEntries(lessonsDir, issues, 'lessons directory')) {
    const worldPath = join(lessonsDir, worldName);
    if (!statSync(worldPath).isDirectory()) {
      issues.push(
        `lessons/${worldName}: unexpected file in lessons directory (expected a world directory)`,
      );
      continue;
    }
    for (const fileName of readEntries(worldPath, issues, `lessons/${worldName} directory`)) {
      const relPath = `lessons/${worldName}/${fileName}`;
      if (!fileName.endsWith('.yaml')) {
        issues.push(`${relPath}: invalid file name (expected <lesson-id>.yaml)`);
        continue;
      }
      const lesson = compileLessonFile(
        join(worldPath, fileName),
        relPath,
        worldName,
        content,
        schemas,
        issues,
      );
      if (lesson !== null) {
        lessons.push(lesson);
      }
    }
  }

  for (const fileName of readEntries(minigamesDir, issues, 'minigames directory')) {
    const relPath = `minigames/${fileName}`;
    if (!fileName.endsWith('.yaml')) {
      issues.push(`${relPath}: invalid file name (expected <id>.yaml)`);
      continue;
    }
    const minigame = compileMiniGameFile(
      join(minigamesDir, fileName),
      relPath,
      content,
      schemas,
      issues,
    );
    if (minigame !== null) {
      minigames.push(minigame);
    }
  }

  validateSemantics(lessons, minigames, locales, content, issues);

  if (issues.length > 0) {
    throw new ContentError(issues);
  }

  // Single trust boundary from the generic bundle to the subject's own concrete content shape.
  return { version: 1, lessons, minigames } as unknown as C;
}
