import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type {
  Color,
  CompiledContent,
  DemoHighlight,
  ExerciseDef,
  Lesson,
  MiniGame,
  Piece,
  Position,
  Square,
  VersusMiniGame,
} from '@chess-kids/core';
import {
  chessJsRules,
  createVariantRules,
  doubleStepBefore,
  game,
  hasKing,
  hasPieceOf,
  optimalMoves,
  staticGoalExercise,
} from '@chess-kids/core';
import { solutionOf } from '@chess-kids/core/testing';
import { parse as parseYaml } from 'yaml';
import type { z, ZodError } from 'zod';
import { contentKindOf } from './kinds/index.ts';
import { compilePosition } from './kinds/common.ts';
import { makeCompileContext } from './kinds/kind-content.ts';
import { ContentError, type Locales } from './load.ts';
import type { LocaleTree } from './schema.ts';
import {
  type ExerciseYaml,
  type WinConditionYaml,
  lessonSchema,
  miniGameSchema,
} from './lesson-schema.ts';

const rules = createVariantRules(chessJsRules);

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
 * Compiles one exercise (`guided` / `exercises` / `variants` / series `rounds` entry): parses its
 * position and `lastMove` (shared by every kind), then hands the rest to its own kind's `compile`
 * (`kinds/<type>/compile.ts`, via the `EXERCISE_KIND_CONTENT` registry) through a `CompileContext`
 * that supplies the head (`id`/`concept`/`textKey`/`position`) and tail (`easier`/`lastMove`) every
 * exercise shares.
 */
function compileExercise(
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
function compileExercises(
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

/** Parses a demo's `highlight` string (schema-validated) into a `DemoHighlight`. */
function compileDemoHighlight(raw: string): DemoHighlight {
  if (raw.startsWith('legal-moves ')) {
    return { legalMovesFrom: raw.slice('legal-moves '.length) as Square };
  }
  const rest = raw.slice('squares'.length).trim();
  return { squares: rest === '' ? [] : (rest.split(' ') as Square[]) };
}

function compileLessonFile(filePath: string, relPath: string, issues: string[]): Lesson | null {
  let raw: string;
  try {
    raw = readFileSync(filePath, 'utf8');
  } catch (error) {
    issues.push(`${relPath}: cannot read file: ${errorMessage(error)}`);
    return null;
  }

  let parsed: unknown;
  try {
    parsed = parseYaml(raw, { uniqueKeys: true });
  } catch (error) {
    issues.push(`${relPath}: YAML syntax error: ${errorMessage(error)}`);
    return null;
  }

  const result = lessonSchema.safeParse(parsed);
  if (!result.success) {
    issues.push(...formatZodIssues(relPath, result.error));
    return null;
  }
  const data = result.data;

  const demoPosition = compilePosition(relPath, 'demo.board', data.demo, issues);
  const guided = compileExercises(relPath, 'guided', data.guided, data.concept, issues);
  const exercises = compileExercises(relPath, 'exercises', data.exercises, data.concept, issues);
  const variants = compileExercises(relPath, 'variants', data.variants ?? [], data.concept, issues);
  if (demoPosition === null || guided === null || exercises === null || variants === null) {
    return null;
  }

  return {
    id: data.id,
    world: data.world,
    order: data.order,
    concept: data.concept,
    character: data.character,
    titleKey: `lessons:${data.title}`,
    storyKey: `lessons:${data.story}`,
    demo: {
      position: demoPosition,
      textKey: `lessons:${data.demo.text}`,
      // `demoSchema` already validated the "legal-moves <square>" / "squares [<sq> …]" shape.
      highlight: compileDemoHighlight(data.demo.highlight),
    },
    guided,
    exercises,
    ...(variants.length > 0 ? { variants } : {}),
    ...(data.boss === undefined ? {} : { boss: data.boss }),
  };
}

/** One authored win condition (`lesson-schema.ts`'s `winConditionSchema`) → domain `WinCondition`. */
function compileWinCondition(raw: WinConditionYaml): game.WinCondition {
  if (typeof raw === 'string') {
    return { kind: raw };
  }
  if ('capture' in raw) {
    return { kind: 'capture', piece: raw.capture as Piece['type'] };
  }
  if ('reach' in raw) {
    return { kind: 'reach', squares: raw.reach as readonly Square[] };
  }
  return { kind: 'survive', moves: raw.survive };
}

/**
 * A `versus` mini-game's authored `rules` (kid/opponent win lists) → `GameRulesDef` (`w`/`b` win
 * lists), by `kidColor`. `checkRules` is derived from `kings`: check/checkmate/stalemate only ever
 * apply when both kings are on the board (`domain-model.md` §1.4).
 */
function compileVersusRules(
  raw: {
    readonly kings: boolean;
    readonly noMoves: 'lose' | 'draw';
    readonly win: {
      readonly kid: readonly WinConditionYaml[];
      readonly opponent: readonly WinConditionYaml[];
    };
  },
  kidColor: Color,
  moveLimit: number | undefined,
): game.GameRulesDef {
  const kidWin = raw.win.kid.map(compileWinCondition);
  const opponentWin = raw.win.opponent.map(compileWinCondition);
  const win = kidColor === 'w' ? { w: kidWin, b: opponentWin } : { w: opponentWin, b: kidWin };
  return {
    kings: raw.kings,
    checkRules: raw.kings,
    noMoves: raw.noMoves,
    win,
    ...(moveLimit === undefined ? {} : { moveLimit }),
  };
}

function compileMiniGameFile(filePath: string, relPath: string, issues: string[]): MiniGame | null {
  let raw: string;
  try {
    raw = readFileSync(filePath, 'utf8');
  } catch (error) {
    issues.push(`${relPath}: cannot read file: ${errorMessage(error)}`);
    return null;
  }

  let parsed: unknown;
  try {
    parsed = parseYaml(raw, { uniqueKeys: true });
  } catch (error) {
    issues.push(`${relPath}: YAML syntax error: ${errorMessage(error)}`);
    return null;
  }

  const result = miniGameSchema.safeParse(parsed);
  if (!result.success) {
    issues.push(...formatZodIssues(relPath, result.error));
    return null;
  }
  const data = result.data;

  if (data.mode === 'series') {
    const rounds = compileExercises(relPath, 'rounds', data.rounds, data.concept, issues);
    if (rounds === null) {
      return null;
    }
    return {
      mode: 'series',
      id: data.id,
      concept: data.concept,
      rounds,
      errors3: data.errors3,
      errors2: data.errors2,
      titleKey: `lessons:${data.title}`,
      goalKey: `lessons:${data.goal}`,
      unlockAfter: data.unlockAfter,
    };
  }

  if (data.mode === 'versus') {
    const versusPosition = compilePosition(relPath, 'board', data, issues);
    if (versusPosition === null) {
      return null;
    }
    const kidColor = data.kidColor ?? 'w';
    return {
      mode: 'versus',
      id: data.id,
      concept: data.concept,
      rules: compileVersusRules(data.rules, kidColor, data.moveLimit),
      position: versusPosition,
      opponentLevel: data.opponent.bot as 1 | 2 | 3 | 4 | 5,
      kidColor,
      ...(data.par === undefined ? {} : { par: data.par }),
      titleKey: `lessons:${data.title}`,
      goalKey: `lessons:${data.goal}`,
      unlockAfter: data.unlockAfter,
    };
  }

  const position = compilePosition(relPath, 'board', data, issues);
  if (position === null) {
    return null;
  }

  return {
    mode: 'static',
    id: data.id,
    concept: data.concept,
    position,
    goal: data.type ?? 'capture-all',
    par: data.par,
    moveLimit: data.moveLimit,
    titleKey: `lessons:${data.title}`,
    goalKey: `lessons:${data.goal}`,
    unlockAfter: data.unlockAfter,
  };
}

/** True when `position.toMove`'s side has at least one piece on the board. */
function hasKidPiece(position: Position): boolean {
  return hasPieceOf(position, position.toMove);
}

/**
 * `versus` mini-game checks (domain-model.md §1.4: "position valid, win conditions valid"): the
 * board matches `rules.kings` (both present / both absent), and the game is not already over at
 * its own start position (an instant win/draw there means the boss is unplayable).
 */
function checkVersusMiniGame(miniGame: VersusMiniGame, where: string, issues: string[]): void {
  if (
    miniGame.rules.kings &&
    (!hasKing(miniGame.position, 'w') || !hasKing(miniGame.position, 'b'))
  ) {
    issues.push(`${where}: rules.kings is true but the start position is missing a king`);
  }
  if (
    !miniGame.rules.kings &&
    (hasKing(miniGame.position, 'w') || hasKing(miniGame.position, 'b'))
  ) {
    issues.push(`${where}: rules.kings is false but the start position has a king`);
  }
  const started = game.startGame(miniGame.rules, miniGame.position);
  const result = game.gameResult(started, chessJsRules);
  if (result.kind !== 'ongoing') {
    issues.push(`${where}: the game is already over at its start position (${result.kind})`);
  }
}

function checkMiniGame(miniGame: MiniGame, where: string, issues: string[]): void {
  if (miniGame.mode === 'series') {
    for (const [index, round] of miniGame.rounds.entries()) {
      contentKindOf(round.type).verify?.(round, `${where}: rounds[${String(index)}]`, issues);
    }
    return;
  }
  if (miniGame.mode === 'versus') {
    checkVersusMiniGame(miniGame, where, issues);
    return;
  }
  const asExercise = staticGoalExercise({
    id: miniGame.id,
    concept: miniGame.concept,
    textKey: miniGame.titleKey,
    position: miniGame.position,
    goal: miniGame.goal,
    par: miniGame.par,
  });
  if (asExercise.type === 'collect-stars' && miniGame.position.markers.stars.length === 0) {
    issues.push(`${where}: collect-stars mini-game has no star`);
    return;
  }
  const optimal = optimalMoves(asExercise, rules);
  if (optimal === null) {
    issues.push(`${where}: no solution found (not solvable within the search depth)`);
    return;
  }
  if (optimal !== miniGame.par) {
    issues.push(
      `${where}: par is ${String(miniGame.par)} but the optimal solve is ${String(optimal)} move(s)`,
    );
  }
  if (miniGame.moveLimit !== undefined && miniGame.moveLimit <= miniGame.par) {
    issues.push(
      `${where}: moveLimit (${String(miniGame.moveLimit)}) must be greater than par (${String(miniGame.par)})`,
    );
  }
}

/** Looks up a dot-separated key path in a locale tree (e.g. `rook.story`). */
function hasKeyPath(tree: LocaleTree, dotPath: string): boolean {
  let node: LocaleTree | string = tree;
  for (const segment of dotPath.split('.')) {
    if (typeof node === 'string') {
      return false;
    }
    const child: LocaleTree | string | undefined = node[segment];
    if (child === undefined) {
      return false;
    }
    node = child;
  }
  return typeof node === 'string';
}

/** Checks that `fullKey` (e.g. `lessons:rook.story`) resolves to a leaf in the `en` locale. */
function checkTextKey(fullKey: string, locales: Locales, where: string, issues: string[]): void {
  const separatorIndex = fullKey.indexOf(':');
  const namespace = separatorIndex < 0 ? '' : fullKey.slice(0, separatorIndex);
  const dotPath = separatorIndex < 0 ? '' : fullKey.slice(separatorIndex + 1);
  const tree = locales.en?.[namespace];
  if (tree === undefined || dotPath === '' || !hasKeyPath(tree, dotPath)) {
    issues.push(`${where}: missing text key "${fullKey}" in en locale`);
  }
}

/**
 * Per-exercise semantic checks, shared by a lesson's own guided/exercises/variants and a series
 * mini-game's rounds: the instruction text key resolves, a kid piece sits on the position unless
 * this kind says otherwise (`needsKidPiece`, default `true`), every extra text key the kind's
 * `solution` reports (e.g. `choice`'s option texts, via core's `textKeys`) resolves too, and the
 * kind's own semantic/shape check (`verify`, e.g. "collect-stars exercise has no star").
 */
function checkExerciseSemantics(
  exercise: ExerciseDef,
  where: string,
  locales: Locales,
  issues: string[],
): void {
  checkTextKey(exercise.textKey, locales, where, issues);
  const kind = contentKindOf(exercise.type);
  if ((kind.needsKidPiece?.(exercise) ?? true) && !hasKidPiece(exercise.position)) {
    issues.push(`${where}: side to move has no piece`);
  }
  for (const ref of solutionOf(exercise).textKeys?.(exercise) ?? []) {
    checkTextKey(ref.key, locales, `${where}: ${ref.label}`, issues);
  }
  kind.verify?.(exercise, where, issues);
}

/**
 * Per-lesson `easier` / `variants` rules (teaching-process.md §3.3): `easier` only on a scored
 * exercise, referencing a variant id of the same lesson; a variant has no `easier` of its own; and
 * every variant is referenced by at least one exercise.
 */
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
    if (!hasKidPiece(lesson.demo.position)) {
      issues.push(`${lessonWhere}: demo: side to move has no piece`);
    }

    for (const exercise of [...lesson.guided, ...lesson.exercises, ...(lesson.variants ?? [])]) {
      const exerciseWhere = `${lessonWhere}: ${exercise.id}`;
      claimId(exercise.id, exerciseWhere);
      checkExerciseSemantics(exercise, exerciseWhere, locales, issues);
    }

    if (lesson.boss !== undefined && !minigameIds.has(lesson.boss)) {
      issues.push(`${lessonWhere}: boss references unknown mini-game "${lesson.boss}"`);
    }

    checkEasierVariants(lesson, lessonWhere, issues);
  }

  for (const minigame of minigames) {
    const where = `minigames/${minigame.id}.yaml`;
    claimId(minigame.id, where);
    checkTextKey(minigame.titleKey, locales, `${where}: title`, issues);
    checkTextKey(minigame.goalKey, locales, `${where}: goal`, issues);
    if (!lessonIds.has(minigame.unlockAfter)) {
      issues.push(`${where}: unlockAfter references unknown lesson "${minigame.unlockAfter}"`);
    }

    if (minigame.mode === 'series') {
      for (const [index, round] of minigame.rounds.entries()) {
        const roundWhere = `${where}: rounds[${String(index)}]`;
        claimId(round.id, roundWhere);
        checkTextKey(round.textKey, locales, roundWhere, issues);
        const kind = contentKindOf(round.type);
        if ((kind.needsKidPiece?.(round) ?? true) && !hasKidPiece(round.position)) {
          issues.push(`${roundWhere}: side to move has no piece`);
        }
      }
    } else if (!hasKidPiece(minigame.position)) {
      issues.push(`${where}: side to move has no piece`);
    }

    checkMiniGame(minigame, where, issues);
  }
}

/**
 * One issue, formatted `<file>: <path>: <message>`. A mini-game's `mode` makes its schema a union
 * (static / series): an invalid document fails both branches, so `invalid_union` is flattened into
 * every branch's own issues instead of one generic "invalid input" line.
 */
function formatZodIssue(relPath: string, issue: z.core.$ZodIssue): string[] {
  if (issue.code === 'invalid_union') {
    return issue.errors.flatMap((branchIssues) =>
      branchIssues.flatMap((branchIssue) => formatZodIssue(relPath, branchIssue)),
    );
  }
  const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
  return [`${relPath}: ${path}: ${issue.message}`];
}

function formatZodIssues(relPath: string, error: ZodError): string[] {
  return error.issues.flatMap((issue) => formatZodIssue(relPath, issue));
}

function readEntries(dir: string, issues: string[], description: string): string[] {
  try {
    return readdirSync(dir).sort();
  } catch (error) {
    issues.push(`${dir}: cannot read ${description}: ${errorMessage(error)}`);
    return [];
  }
}

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.split('\n')[0] ?? message;
}

/**
 * Loads and validates every lesson and mini-game file, compiling them to `CompiledContent`.
 * Collects every issue (parse, compile and semantic) before throwing a single `ContentError`.
 */
export function loadContent(
  lessonsDir: string,
  minigamesDir: string,
  locales: Locales,
): CompiledContent {
  const issues: string[] = [];
  const lessons: Lesson[] = [];
  const minigames: MiniGame[] = [];

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
      const lesson = compileLessonFile(join(worldPath, fileName), relPath, issues);
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
    const minigame = compileMiniGameFile(join(minigamesDir, fileName), relPath, issues);
    if (minigame !== null) {
      minigames.push(minigame);
    }
  }

  validateSemantics(lessons, minigames, locales, issues);

  if (issues.length > 0) {
    throw new ContentError(issues);
  }

  return { version: 1, lessons, minigames };
}
