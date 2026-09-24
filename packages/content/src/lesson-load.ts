import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type {
  BestMoveDef,
  CaptureDef,
  ChoiceOption,
  CollectStarsDef,
  CompiledContent,
  ExerciseDef,
  Lesson,
  MiniGame,
  Piece,
  Position,
  SetupDef,
  Square,
} from '@chess-kids/core';
import {
  DiagramError,
  FenError,
  chessJsRules,
  createVariantRules,
  optimalMoves,
  parseDiagram,
  parseFen,
} from '@chess-kids/core';
import { parse as parseYaml } from 'yaml';
import type { ZodError } from 'zod';
import { ContentError, type Locales } from './load.ts';
import type { LocaleTree } from './schema.ts';
import {
  type ChoiceOptionYaml,
  type ExerciseYaml,
  lessonSchema,
  miniGameSchema,
} from './lesson-schema.ts';

const rules = createVariantRules(chessJsRules);

/** Fields shared by any authored position (board diagram or FEN, exactly one). */
interface PositionYaml {
  readonly board?: string;
  readonly fen?: string;
  readonly toMove?: 'w' | 'b';
}

/** Parses a board diagram or FEN into a `Position`, reporting `DiagramError` / `FenError` as an issue. */
function compilePosition(
  relPath: string,
  fieldPath: string,
  raw: PositionYaml,
  issues: string[],
): Position | null {
  try {
    if (raw.board !== undefined) {
      return parseDiagram(raw.board, { toMove: raw.toMove });
    }
    return parseFen(raw.fen ?? '');
  } catch (error) {
    if (error instanceof DiagramError || error instanceof FenError) {
      issues.push(`${relPath}: ${fieldPath}: ${error.message}`);
      return null;
    }
    throw error;
  }
}

/** Value guaranteed non-`undefined` by a zod schema that already validated successfully. */
function assertValidated<T>(value: T | undefined, context: string): T {
  if (value === undefined) {
    throw new Error(`lesson-load: ${context}: expected a value already validated by the schema`);
  }
  return value;
}

/** FEN letter → `Piece` (upper case = white); `choiceOptionSchema` already restricts the alphabet. */
function pieceFromLetter(letter: string): Piece {
  const color = letter === letter.toUpperCase() ? 'w' : 'b';
  return { color, type: letter.toLowerCase() as Piece['type'] };
}

function compileChoiceOption(raw: ChoiceOptionYaml): ChoiceOption {
  return {
    id: raw.id,
    ...(raw.text === undefined ? {} : { textKey: `lessons:${raw.text}` }),
    ...(raw.piece === undefined ? {} : { piece: pieceFromLetter(raw.piece) }),
  };
}

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
  const textKey = `lessons:${raw.text}`;
  const easier = raw.easier === undefined ? {} : { easier: raw.easier };

  if (raw.type === 'select-squares') {
    const answer =
      raw.answer !== undefined
        ? { squares: raw.answer as readonly Square[] }
        : {
            derive: 'legal-moves' as const,
            from: assertValidated(raw.from, `${fieldPath}.from`) as Square,
          };
    return { id: raw.id, concept, textKey, position, type: 'select-squares', answer, ...easier };
  }
  if (raw.type === 'yes-no') {
    return {
      id: raw.id,
      concept,
      textKey,
      position,
      type: 'yes-no',
      answer: raw.answer === 'yes',
      ...(raw.focus === undefined ? {} : { focus: raw.focus as Square }),
      ...easier,
    };
  }
  if (raw.type === 'choice') {
    return {
      id: raw.id,
      concept,
      textKey,
      position,
      type: 'choice',
      options: raw.options.map(compileChoiceOption),
      answer: raw.answer,
      showBoard: raw.showBoard ?? true,
      ...easier,
    };
  }
  if (raw.type === 'best-move') {
    return {
      id: raw.id,
      concept,
      textKey,
      position,
      type: 'best-move',
      solutions: raw.solutions,
      ...easier,
    };
  }
  if (raw.type === 'setup') {
    const target = compilePosition(relPath, `${fieldPath}.target.board`, raw.target, issues);
    if (target === null) {
      return null;
    }
    return { id: raw.id, concept, textKey, position, type: 'setup', target, ...easier };
  }
  return {
    id: raw.id,
    concept,
    textKey,
    position,
    type: raw.type,
    stars3: raw.stars3,
    stars2: raw.stars2,
    ...easier,
  };
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
  if (demoPosition === null || guided === null || exercises === null) {
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
      // `demoSchema` already validated the "legal-moves <square>" shape.
      highlight: { legalMovesFrom: data.demo.highlight.slice('legal-moves '.length) as Square },
    },
    guided,
    exercises,
    ...(data.boss === undefined ? {} : { boss: data.boss }),
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

  const position = compilePosition(relPath, 'board', data, issues);
  if (position === null) {
    return null;
  }

  return {
    id: data.id,
    concept: data.concept,
    position,
    par: data.par,
    moveLimit: data.moveLimit,
    titleKey: `lessons:${data.title}`,
    goalKey: `lessons:${data.goal}`,
    unlockAfter: data.unlockAfter,
  };
}

/** True when `position.toMove`'s side has at least one piece on the board. */
function hasKidPiece(position: Position): boolean {
  return Object.values(position.pieces).some((piece) => piece.color === position.toMove);
}

/** Strips a trailing check/mate mark, matching the engine's own SAN comparison (`engine.ts`). */
function normalizeSan(san: string): string {
  return san.replace(/[+#]+$/, '');
}

function checkBestMoveShape(exercise: BestMoveDef, where: string, issues: string[]): void {
  const legalSans = new Set(
    rules
      .legalMoves(exercise.position, { staticOpponent: true })
      .map((move) => normalizeSan(move.san)),
  );
  for (const solution of exercise.solutions) {
    if (!legalSans.has(normalizeSan(solution))) {
      issues.push(`${where}: solution "${solution}" is not a legal move in the position`);
    }
  }
}

/** True when both piece maps hold exactly the same pieces on the same squares. */
function piecesEqual(a: Position['pieces'], b: Position['pieces']): boolean {
  const aEntries = Object.entries(a);
  const bEntries = Object.entries(b);
  if (aEntries.length !== bEntries.length) {
    return false;
  }
  return aEntries.every(([square, piece]) => {
    const other = b[square as Square];
    return other !== undefined && other.color === piece.color && other.type === piece.type;
  });
}

function checkSetupShape(exercise: SetupDef, where: string, issues: string[]): void {
  const { position, target } = exercise;
  if (target.markers.stars.length > 0 || target.markers.blocked.length > 0) {
    issues.push(`${where}: setup target must not use star or blocked markers`);
  }
  for (const [square, piece] of Object.entries(position.pieces)) {
    const targetPiece = target.pieces[square as Square];
    if (
      targetPiece === undefined ||
      targetPiece.color !== piece.color ||
      targetPiece.type !== piece.type
    ) {
      issues.push(`${where}: start piece at ${square} is not part of the target`);
    }
  }
  if (piecesEqual(position.pieces, target.pieces)) {
    issues.push(`${where}: setup target is the same as the start position`);
  }
}

function checkExerciseShape(exercise: ExerciseDef, where: string, issues: string[]): void {
  if (exercise.type === 'collect-stars') {
    if (exercise.position.markers.stars.length === 0) {
      issues.push(`${where}: collect-stars exercise has no star`);
    }
    checkOptimalMoves(exercise, where, issues);
    return;
  }
  if (exercise.type === 'capture') {
    const opponentPieces = Object.values(exercise.position.pieces).filter(
      (piece) => piece.color !== exercise.position.toMove,
    ).length;
    if (opponentPieces === 0) {
      issues.push(`${where}: capture exercise has no opponent piece`);
    }
    checkOptimalMoves(exercise, where, issues);
    return;
  }
  if (exercise.type === 'select-squares') {
    if ('squares' in exercise.answer) {
      if (exercise.answer.squares.length === 0) {
        issues.push(`${where}: select-squares answer is empty`);
      }
      return;
    }
    const fromPiece = exercise.position.pieces[exercise.answer.from];
    if (fromPiece === undefined || fromPiece.color !== exercise.position.toMove) {
      issues.push(`${where}: select-squares "from" square has no piece of the side to move`);
    }
    return;
  }
  if (exercise.type === 'best-move') {
    checkBestMoveShape(exercise, where, issues);
    return;
  }
  if (exercise.type === 'setup') {
    checkSetupShape(exercise, where, issues);
  }
  // choice: uniqueness, answer membership and "text or piece" are schema-level (lesson-schema.ts).
  // yes-no: the schema already guarantees a boolean answer and a valid (optional) focus square.
}

function checkOptimalMoves(
  exercise: CaptureDef | CollectStarsDef,
  where: string,
  issues: string[],
): void {
  const optimal = optimalMoves(exercise, rules);
  if (optimal === null) {
    issues.push(`${where}: no solution found (not solvable within the search depth)`);
    return;
  }
  if (optimal !== exercise.stars3) {
    issues.push(
      `${where}: stars3 is ${String(exercise.stars3)} but the optimal solve is ${String(optimal)} move(s)`,
    );
  }
  if (exercise.stars2 < exercise.stars3) {
    issues.push(
      `${where}: stars2 (${String(exercise.stars2)}) is below stars3 (${String(exercise.stars3)})`,
    );
  }
}

function checkMiniGame(miniGame: MiniGame, where: string, issues: string[]): void {
  const asCapture: CaptureDef = {
    id: miniGame.id,
    concept: miniGame.concept,
    textKey: miniGame.titleKey,
    position: miniGame.position,
    type: 'capture',
    stars3: miniGame.par,
    stars2: miniGame.par,
  };
  const optimal = optimalMoves(asCapture, rules);
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
  const exerciseIds = new Set<string>();
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

    for (const exercise of [...lesson.guided, ...lesson.exercises]) {
      const exerciseWhere = `${lessonWhere}: ${exercise.id}`;
      exerciseIds.add(exercise.id);
      claimId(exercise.id, exerciseWhere);
      checkTextKey(exercise.textKey, locales, exerciseWhere, issues);
      // setup exercises typically start from an empty board: "side to move has a piece" doesn't apply.
      if (exercise.type !== 'setup' && !hasKidPiece(exercise.position)) {
        issues.push(`${exerciseWhere}: side to move has no piece`);
      }
      if (exercise.type === 'choice') {
        for (const option of exercise.options) {
          if (option.textKey !== undefined) {
            checkTextKey(
              option.textKey,
              locales,
              `${exerciseWhere}: option "${option.id}"`,
              issues,
            );
          }
        }
      }
      checkExerciseShape(exercise, exerciseWhere, issues);
    }

    if (lesson.boss !== undefined && !minigameIds.has(lesson.boss)) {
      issues.push(`${lessonWhere}: boss references unknown mini-game "${lesson.boss}"`);
    }
  }

  for (const lesson of lessons) {
    for (const exercise of [...lesson.guided, ...lesson.exercises]) {
      if (exercise.easier !== undefined && !exerciseIds.has(exercise.easier)) {
        issues.push(
          `lessons/${lesson.world}/${lesson.id}.yaml: ${exercise.id}: easier references unknown exercise "${exercise.easier}"`,
        );
      }
    }
  }

  for (const minigame of minigames) {
    const where = `minigames/${minigame.id}.yaml`;
    claimId(minigame.id, where);
    checkTextKey(minigame.titleKey, locales, `${where}: title`, issues);
    checkTextKey(minigame.goalKey, locales, `${where}: goal`, issues);
    if (!hasKidPiece(minigame.position)) {
      issues.push(`${where}: side to move has no piece`);
    }
    if (!lessonIds.has(minigame.unlockAfter)) {
      issues.push(`${where}: unlockAfter references unknown lesson "${minigame.unlockAfter}"`);
    }
    checkMiniGame(minigame, where, issues);
  }
}

function formatZodIssues(relPath: string, error: ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
    return `${relPath}: ${path}: ${issue.message}`;
  });
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
