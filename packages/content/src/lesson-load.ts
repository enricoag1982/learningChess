import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type {
  BestMoveDef,
  CaptureDef,
  ChoiceDef,
  ChoiceOption,
  CollectStarsDef,
  Color,
  CompiledContent,
  DemoHighlight,
  ExerciseDef,
  Lesson,
  MateInNDef,
  MiniGame,
  Piece,
  Position,
  Square,
  SelectSquaresDef,
  SetupDef,
  VersusMiniGame,
  YesNoDef,
} from '@chess-kids/core';
import {
  DiagramError,
  FenError,
  chessJsRules,
  createVariantRules,
  game,
  isAttacked,
  isCheckmate,
  isDefended,
  isHanging,
  isInCheck,
  isSafe,
  isStalemate,
  kingSquare,
  optimalMoves,
  parseDiagram,
  parseFen,
  pieceValue,
  selectSquaresAnswer,
} from '@chess-kids/core';
import { parse as parseYaml } from 'yaml';
import type { z, ZodError } from 'zod';
import { ContentError, type Locales } from './load.ts';
import type { LocaleTree } from './schema.ts';
import {
  type ChoiceOptionYaml,
  type ExerciseYaml,
  type WinConditionYaml,
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

/** A `yes-no` exercise's parsed `verify` field (`lesson-schema.ts`'s `yesNoVerifySchema`). */
type VerifyFact =
  | { readonly kind: 'hanging' | 'attacked' | 'defended'; readonly square: Square }
  | { readonly kind: 'in-check' | 'checkmate' | 'stalemate' };

function parseVerify(raw: string): VerifyFact {
  const [kind, square] = raw.split(' ');
  if (kind === 'in-check' || kind === 'checkmate' || kind === 'stalemate') {
    return { kind };
  }
  return { kind: kind as 'hanging' | 'attacked' | 'defended', square: square as Square };
}

function computeVerifyFact(fact: VerifyFact, position: Position): boolean {
  if (fact.kind === 'hanging') return isHanging(position, fact.square, chessJsRules);
  if (fact.kind === 'attacked') return isAttacked(position, fact.square, chessJsRules);
  if (fact.kind === 'defended') return isDefended(position, fact.square, chessJsRules);
  if (fact.kind === 'in-check') return isInCheck(position, chessJsRules);
  if (fact.kind === 'checkmate') return isCheckmate(position, chessJsRules);
  return isStalemate(position, chessJsRules);
}

/**
 * A `yes-no` exercise's optional `verify` (`lesson-schema.ts`): computes the named rule fact on the
 * exercise's own position and fails the build if it contradicts `answer`, so a "safe?" / "in
 * check?" answer authored by hand can never be wrong. Load-time only: never affects the compiled
 * `YesNoDef`.
 */
function checkYesNoVerify(
  exercise: YesNoDef,
  verify: string | undefined,
  where: string,
  issues: string[],
): void {
  if (verify === undefined) {
    return;
  }
  const fact = parseVerify(verify);
  const actual = computeVerifyFact(fact, exercise.position);
  if (actual !== exercise.answer) {
    const answerWord = exercise.answer ? 'yes' : 'no';
    issues.push(`${where}: verify "${verify}" is ${String(actual)}, but answer is "${answerWord}"`);
    return;
  }
  // "Not hanging" must also mean safe in real chess: a defended piece attacked by a cheaper one
  // still loses material, so such a position would teach "defended = safe" wrongly.
  if (
    fact.kind === 'hanging' &&
    !actual &&
    isAttacked(exercise.position, fact.square, chessJsRules) &&
    !isSafe(exercise.position, fact.square, chessJsRules)
  ) {
    issues.push(
      `${where}: verify "${verify}": the piece is defended but attacked by a cheaper piece (not safe); use another position`,
    );
  }
}

/**
 * Classifies a kid capture (M3.2b `docs/curriculum.md` World 3 "Trades"): `good` when the captured
 * piece is worth more than the capturer or is undefended (a free or winning capture either way),
 * `equal` when same value and defended, `bad` when worth less than the capturer and defended (a
 * losing trade even though it looks like "getting" a piece). Shared by `choice`'s `trade <SAN>`
 * verify and `best-move`'s `good-trade` verify.
 */
function classifyTrade(
  capturedValue: number,
  capturerValue: number,
  defended: boolean,
): 'good' | 'equal' | 'bad' {
  if (!defended || capturedValue > capturerValue) return 'good';
  if (capturedValue === capturerValue) return 'equal';
  return 'bad';
}

/** A `choice` exercise's optional `verify` (`lesson-schema.ts`'s regex already restricts the shape). */
type ChoiceVerify =
  | { readonly kind: 'higher-value' }
  | { readonly kind: 'worth'; readonly value: number }
  | { readonly kind: 'trade'; readonly san: string };

function parseChoiceVerify(raw: string): ChoiceVerify {
  if (raw === 'higher-value') return { kind: 'higher-value' };
  if (raw.startsWith('worth ')) {
    return { kind: 'worth', value: Number(raw.slice('worth '.length)) };
  }
  return { kind: 'trade', san: raw.slice('trade '.length) };
}

/** Every option's piece value, or `null` (with an issue pushed) if any option is not a piece. */
function optionValues(
  exercise: ChoiceDef,
  verifyLabel: string,
  where: string,
  issues: string[],
): readonly number[] | null {
  const values = exercise.options.map((option) =>
    option.piece === undefined ? undefined : pieceValue(option.piece.type),
  );
  if (values.some((value) => value === undefined)) {
    issues.push(`${where}: verify "${verifyLabel}" requires every option to be a piece`);
    return null;
  }
  return values as number[];
}

function checkChoiceHigherValue(exercise: ChoiceDef, where: string, issues: string[]): void {
  const values = optionValues(exercise, 'higher-value', where, issues);
  if (values === null) return;
  const max = Math.max(...values);
  const winners = exercise.options.filter((_, index) => values[index] === max);
  const winner = winners[0];
  if (winners.length !== 1 || winner === undefined) {
    issues.push(`${where}: verify "higher-value" requires a unique highest-value option`);
    return;
  }
  if (winner.id !== exercise.answer) {
    issues.push(
      `${where}: verify "higher-value": answer should be "${winner.id}", the higher-value option`,
    );
  }
}

function checkChoiceWorth(
  exercise: ChoiceDef,
  target: number,
  where: string,
  issues: string[],
): void {
  const label = `worth ${String(target)}`;
  const values = optionValues(exercise, label, where, issues);
  if (values === null) return;
  const winners = exercise.options.filter((_, index) => values[index] === target);
  const winner = winners[0];
  if (winners.length !== 1 || winner === undefined) {
    issues.push(`${where}: verify "${label}" requires exactly one option worth ${String(target)}`);
    return;
  }
  if (winner.id !== exercise.answer) {
    issues.push(`${where}: verify "${label}": answer should be "${winner.id}"`);
  }
}

const TRADE_OPTION_IDS: ReadonlySet<string> = new Set(['good', 'equal', 'bad']);

function checkChoiceTrade(exercise: ChoiceDef, san: string, where: string, issues: string[]): void {
  const label = `trade ${san}`;
  const ids = new Set(exercise.options.map((option) => option.id));
  if (ids.size !== TRADE_OPTION_IDS.size || ![...TRADE_OPTION_IDS].every((id) => ids.has(id))) {
    issues.push(`${where}: verify "${label}" requires options ids "good", "equal", "bad"`);
    return;
  }
  const played = chessJsRules.play(exercise.position, san);
  if (played === null || played.move.captured === undefined) {
    issues.push(`${where}: verify "${label}" is not a legal capture in the position`);
    return;
  }
  const classification = classifyTrade(
    pieceValue(played.move.captured),
    pieceValue(played.move.piece),
    isDefended(exercise.position, played.move.to, chessJsRules),
  );
  if (classification !== exercise.answer) {
    issues.push(
      `${where}: verify "${label}" classifies as "${classification}", but answer is "${exercise.answer}"`,
    );
  }
}

/**
 * A `choice` exercise's optional `verify` (`lesson-schema.ts`): `higher-value` / `worth <n>` need
 * every option to be a piece; `trade <SAN>` classifies a kid capture. Load-time only: never affects
 * the compiled `ChoiceDef`.
 */
function checkChoiceVerify(
  exercise: ChoiceDef,
  verify: string | undefined,
  where: string,
  issues: string[],
): void {
  if (verify === undefined) {
    return;
  }
  const parsed = parseChoiceVerify(verify);
  if (parsed.kind === 'higher-value') {
    checkChoiceHigherValue(exercise, where, issues);
    return;
  }
  if (parsed.kind === 'worth') {
    checkChoiceWorth(exercise, parsed.value, where, issues);
    return;
  }
  checkChoiceTrade(exercise, parsed.san, where, issues);
}

/** A `best-move` exercise's optional `verify` (`lesson-schema.ts`'s regex already restricts the shape). */
type BestMoveVerify =
  | { readonly kind: 'attack' | 'save'; readonly square: Square }
  | {
      readonly kind:
        'take-free' | 'good-trade' | 'check' | 'escape-king' | 'escape-block' | 'escape-capture';
    };

function parseBestMoveVerify(raw: string): BestMoveVerify {
  const [kind, square] = raw.split(' ');
  if (kind === 'attack' || kind === 'save') {
    return { kind, square: square as Square };
  }
  return {
    kind: kind as
      'take-free' | 'good-trade' | 'check' | 'escape-king' | 'escape-block' | 'escape-capture',
  };
}

/**
 * The exact set of legal kid moves (SAN) satisfying a `best-move` `verify` rule in `position`, or
 * `null` (with an issue pushed) when the rule's own precondition is not met — `attack <sq>` needs
 * an enemy piece on `<sq>`, `save <sq>` needs the kid's own, not-yet-safe piece there. `take-free`
 * and `good-trade` have no precondition of their own (an empty result is instead reported by the
 * caller, alongside a mismatch, as the general "empty computed set" issue).
 */
function computeVerifiedBestMoves(
  verify: BestMoveVerify,
  position: Position,
  where: string,
  verifyLabel: string,
  issues: string[],
): readonly string[] | null {
  const kidColor = position.toMove;
  const candidates = rules.legalMoves(position, { staticOpponent: true });

  if (verify.kind === 'attack') {
    const target = position.pieces[verify.square];
    if (target === undefined || target.color === kidColor) {
      issues.push(`${where}: verify "${verifyLabel}" requires an enemy piece on ${verify.square}`);
      return null;
    }
    const beforeAttackers = new Set(chessJsRules.attackers(position, verify.square, kidColor));
    return candidates
      .filter((move) => {
        const played = rules.play(position, { staticOpponent: true }, move.san);
        if (played === null) return false;
        const occupant = played.position.pieces[verify.square];
        if (occupant === undefined || occupant.color === kidColor) return false;
        const afterAttackers = chessJsRules.attackers(played.position, verify.square, kidColor);
        return afterAttackers.includes(move.to) && !beforeAttackers.has(move.from);
      })
      .map((move) => move.san);
  }

  if (verify.kind === 'save') {
    const target = position.pieces[verify.square];
    if (target === undefined || target.color !== kidColor) {
      issues.push(
        `${where}: verify "${verifyLabel}" requires the kid's own piece on ${verify.square}`,
      );
      return null;
    }
    if (isSafe(position, verify.square, chessJsRules)) {
      issues.push(`${where}: verify "${verifyLabel}" requires that piece to not be safe yet`);
      return null;
    }
    return candidates
      .filter((move) => {
        const played = rules.play(position, { staticOpponent: true }, move.san);
        if (played === null) return false;
        const finalSquare = move.from === verify.square ? move.to : verify.square;
        return isSafe(played.position, finalSquare, chessJsRules);
      })
      .map((move) => move.san);
  }

  if (verify.kind === 'take-free') {
    return candidates
      .filter((move) => move.captured !== undefined && !isDefended(position, move.to, chessJsRules))
      .map((move) => move.san);
  }

  if (verify.kind === 'check') {
    // chess.js's own verbose `moves()` already appends "+"/"#" to a move's SAN based on the real
    // resulting position, independent of `staticOpponent` (which only affects `play`, not move
    // generation) — the simplest and cheapest way to ask "does this move give check".
    return candidates.filter((move) => /[+#]$/.test(move.san)).map((move) => move.san);
  }

  if (
    verify.kind === 'escape-king' ||
    verify.kind === 'escape-block' ||
    verify.kind === 'escape-capture'
  ) {
    const king = kingSquare(position, kidColor);
    if (king === undefined || !isInCheck(position, chessJsRules)) {
      issues.push(`${where}: verify "${verifyLabel}" requires the kid's king to be in check`);
      return null;
    }
    const opponentColor: Color = kidColor === 'w' ? 'b' : 'w';
    const checkers = new Set(chessJsRules.attackers(position, king, opponentColor));
    return candidates
      .filter((move) => {
        const capturesChecker = move.captured !== undefined && checkers.has(move.to);
        const isKingMove = move.from === king;
        if (verify.kind === 'escape-capture') return capturesChecker;
        if (verify.kind === 'escape-king') return isKingMove && !capturesChecker;
        return !isKingMove && !capturesChecker; // escape-block: the only other legal way out
      })
      .map((move) => move.san);
  }

  // good-trade
  return candidates
    .filter((move) => {
      if (move.captured === undefined) return false;
      const classification = classifyTrade(
        pieceValue(move.captured),
        pieceValue(move.piece),
        isDefended(position, move.to, chessJsRules),
      );
      return classification === 'good';
    })
    .map((move) => move.san);
}

/**
 * A `best-move` exercise's optional `verify` (`lesson-schema.ts`): computes the exact set of legal
 * kid moves satisfying the named rule and fails the build unless `solutions` equals that set,
 * order-insensitive (SAN, check/mate marks ignored like the engine's own comparison). Load-time
 * only: never affects the compiled `BestMoveDef`.
 */
function checkBestMoveVerify(
  exercise: BestMoveDef,
  verify: string | undefined,
  where: string,
  issues: string[],
): void {
  if (verify === undefined) {
    return;
  }
  const parsed = parseBestMoveVerify(verify);
  const computed = computeVerifiedBestMoves(parsed, exercise.position, where, verify, issues);
  if (computed === null) {
    return; // precondition issue already pushed
  }
  if (computed.length === 0) {
    issues.push(`${where}: verify "${verify}" computed no matching move (unsolvable as authored)`);
    return;
  }
  const computedSet = new Set(computed.map(normalizeSan));
  const authoredSet = new Set(exercise.solutions.map(normalizeSan));
  const matches =
    computedSet.size === authoredSet.size && [...computedSet].every((san) => authoredSet.has(san));
  if (!matches) {
    const expected = [...computedSet].sort().join(', ');
    const authored = [...authoredSet].sort().join(', ');
    issues.push(
      `${where}: verify "${verify}": solutions should be [${expected}], authored [${authored}]`,
    );
  }
}

/**
 * A `mate-in-n` exercise's optional `trap: stalemate` (M3.3 "don't stalemate"): requires at least
 * one legal kid move, at the exercise's own start position, that stalemates the opponent instead
 * of the scripted mating line — a mistake the exercise is meant to teach avoiding. Real rules (both
 * kings, real turn alternation), like every other mate-in-n check; never compiled into the runtime
 * `MateInNDef`.
 */
function checkMateInNTrap(
  exercise: MateInNDef,
  trap: 'stalemate' | undefined,
  where: string,
  issues: string[],
): void {
  if (trap === undefined) {
    return;
  }
  const candidates = rules.legalMoves(exercise.position, { staticOpponent: true });
  const hasStalemateTrap = candidates.some((move) => {
    const played = chessJsRules.play(exercise.position, {
      from: move.from,
      to: move.to,
      ...(move.promotion === undefined ? {} : { promotion: move.promotion }),
    });
    return played !== null && isStalemate(played.position, chessJsRules);
  });
  if (!hasStalemateTrap) {
    issues.push(
      `${where}: trap "stalemate" requires >= 1 legal kid move (besides the scripted line) that stalemates the opponent`,
    );
  }
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
    let answer: SelectSquaresDef['answer'];
    if (raw.answer !== undefined) {
      answer = { squares: raw.answer as readonly Square[] };
    } else if (raw.derive === 'check-escapes') {
      answer = { derive: 'check-escapes' };
    } else if (raw.derive === 'attacked-by') {
      answer = {
        derive: 'attacked-by',
        from: assertValidated(raw.from, `${fieldPath}.from`) as Square,
      };
    } else {
      answer = {
        derive: 'legal-moves',
        from: assertValidated(raw.from, `${fieldPath}.from`) as Square,
      };
    }
    return { id: raw.id, concept, textKey, position, type: 'select-squares', answer, ...easier };
  }
  if (raw.type === 'mate-in-n') {
    const exercise: MateInNDef = {
      id: raw.id,
      concept,
      textKey,
      position,
      type: 'mate-in-n',
      n: raw.n,
      line: raw.line,
      ...easier,
    };
    checkMateInNTrap(exercise, raw.trap, `${relPath}: ${fieldPath}`, issues);
    return exercise;
  }
  if (raw.type === 'yes-no') {
    const exercise: YesNoDef = {
      id: raw.id,
      concept,
      textKey,
      position,
      type: 'yes-no',
      answer: raw.answer === 'yes',
      ...(raw.focus === undefined ? {} : { focus: raw.focus as Square }),
      ...easier,
    };
    checkYesNoVerify(exercise, raw.verify, `${relPath}: ${fieldPath}`, issues);
    return exercise;
  }
  if (raw.type === 'choice') {
    const exercise: ChoiceDef = {
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
    checkChoiceVerify(exercise, raw.verify, `${relPath}: ${fieldPath}`, issues);
    return exercise;
  }
  if (raw.type === 'best-move') {
    const exercise: BestMoveDef = {
      id: raw.id,
      concept,
      textKey,
      position,
      type: 'best-move',
      solutions: raw.solutions,
      ...easier,
    };
    checkBestMoveVerify(exercise, raw.verify, `${relPath}: ${fieldPath}`, issues);
    return exercise;
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
  return Object.values(position.pieces).some((piece) => piece.color === position.toMove);
}

/** True when `position` has a `color` king on the board. */
function hasKing(position: Position, color: Color): boolean {
  return Object.values(position.pieces).some(
    (piece) => piece.type === 'k' && piece.color === color,
  );
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

/**
 * `select-squares` with `derive: check-escapes` (`lesson-schema.ts`): the side to move's king must
 * actually be in check, and have at least one legal escape square (else the exercise is either
 * unsolvable or not really about escaping check).
 */
function checkCheckEscapesShape(exercise: SelectSquaresDef, where: string, issues: string[]): void {
  if (!isInCheck(exercise.position, chessJsRules)) {
    issues.push(`${where}: check-escapes requires the side to move's king to be in check`);
    return;
  }
  if (selectSquaresAnswer(exercise, rules).length === 0) {
    issues.push(`${where}: check-escapes has no legal king move`);
  }
}

/**
 * `mate-in-n` (`lesson-schema.ts`): both kings on the board, every line entry a legal move played
 * in sequence under real chess rules (turns alternate normally, never a static opponent), and the
 * final (`n`th) kid move delivers checkmate. `n` matching `line.length` is already schema-enforced.
 */
function checkMateInNShape(exercise: MateInNDef, where: string, issues: string[]): void {
  if (!hasKing(exercise.position, 'w') || !hasKing(exercise.position, 'b')) {
    issues.push(`${where}: mate-in-n requires both kings on the board`);
    return;
  }
  let position = exercise.position;
  for (const [index, san] of exercise.line.entries()) {
    const played = chessJsRules.play(position, san);
    if (played === null) {
      issues.push(`${where}: line[${String(index)}] "${san}" is not a legal move`);
      return;
    }
    position = played.position;
  }
  if (!isCheckmate(position, chessJsRules)) {
    issues.push(`${where}: the final move in "line" does not deliver checkmate`);
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
    if (exercise.answer.derive === 'check-escapes') {
      checkCheckEscapesShape(exercise, where, issues);
      return;
    }
    const fromPiece = exercise.position.pieces[exercise.answer.from];
    if (exercise.answer.derive === 'legal-moves') {
      if (fromPiece === undefined || fromPiece.color !== exercise.position.toMove) {
        issues.push(`${where}: select-squares "from" square has no piece of the side to move`);
      }
      return;
    }
    // attacked-by
    if (fromPiece === undefined) {
      issues.push(`${where}: select-squares "from" square has no piece`);
    }
    return;
  }
  if (exercise.type === 'best-move') {
    checkBestMoveShape(exercise, where, issues);
    return;
  }
  if (exercise.type === 'setup') {
    checkSetupShape(exercise, where, issues);
    return;
  }
  if (exercise.type === 'mate-in-n') {
    checkMateInNShape(exercise, where, issues);
  }
  // choice: uniqueness, answer membership and "text or piece" are schema-level (lesson-schema.ts);
  // "higher-value" verify is checked at compile time (`checkChoiceVerify`).
  // yes-no: the schema already guarantees a boolean answer and a valid (optional) focus square;
  // its own `verify` is checked at compile time (`checkYesNoVerify`).
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
      checkExerciseShape(round, `${where}: rounds[${String(index)}]`, issues);
    }
    return;
  }
  if (miniGame.mode === 'versus') {
    checkVersusMiniGame(miniGame, where, issues);
    return;
  }
  const shared = {
    id: miniGame.id,
    concept: miniGame.concept,
    textKey: miniGame.titleKey,
    position: miniGame.position,
    stars3: miniGame.par,
    stars2: miniGame.par,
  } as const;
  const asExercise: CaptureDef | CollectStarsDef =
    (miniGame.goal ?? 'capture-all') === 'collect-stars'
      ? { ...shared, type: 'collect-stars' }
      : { ...shared, type: 'capture' };
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
        // setup rounds typically start from an empty board: no piece for the side to move yet.
        if (round.type !== 'setup' && !hasKidPiece(round.position)) {
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
