/**
 * Shared `loadContent` test fixtures (lesson/exercise/mini-game builders, a scratch content
 * directory, `load`/`issuesOf`): used by `lesson-load.test.ts` (generic checks) and every
 * `kinds/<type>/*.test.ts` / `modes/<mode>/*.test.ts` (kind/mode-specific checks) — one temp
 * directory per test, via `fixturesBeforeEach`/`fixturesAfterEach` in each file's own hooks.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { stringify } from 'yaml';
import { ContentError, loadLocales } from '../load.ts';
import { loadContent } from '../lesson-load.ts';

/** The current test's scratch content directory (live binding: set fresh by `fixturesBeforeEach`). */
export let dir = '';

export function fixturesBeforeEach(): void {
  dir = mkdtempSync(join(tmpdir(), 'chess-kids-lessons-'));
  mkdirSync(join(dir, 'minigames'), { recursive: true });
}

export function fixturesAfterEach(): void {
  rmSync(dir, { recursive: true, force: true });
}

export function write(relPath: string, content: string): void {
  const filePath = join(dir, relPath);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, 'utf8');
}

/** Board diagram from a square → symbol map; every other square is empty. */
export function diagram(pieces: Record<string, string>): string {
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];
  return ranks
    .map((rank) => files.map((file) => pieces[`${file}${rank}`] ?? '.').join(' '))
    .join('\n');
}

/** Rook on d1, one star on d5: solvable in exactly 1 move. */
export function validExercise(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'demo-01',
    type: 'collect-stars',
    text: 'demo-01',
    board: diagram({ d1: 'R', d5: '*' }),
    stars3: 1,
    stars2: 1,
    ...overrides,
  };
}

/** Rook on d4, no stars3/stars2: a select-squares exercise deriving from `from`. */
export function validSelectSquaresExercise(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: 'demo-01',
    type: 'select-squares',
    text: 'demo-01',
    board: diagram({ a1: 'R' }),
    derive: 'legal-moves',
    from: 'a1',
    ...overrides,
  };
}

/** Rook on a1: a yes-no exercise, answer "yes". */
export function validYesNoExercise(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: 'demo-01',
    type: 'yes-no',
    text: 'demo-01',
    board: diagram({ a1: 'R' }),
    answer: 'yes',
    focus: 'a1',
    ...overrides,
  };
}

/** Rook + pawn on the board: a choice exercise between the two pieces, piece-only options. */
export function validChoiceExercise(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: 'demo-01',
    type: 'choice',
    text: 'demo-01',
    board: diagram({ a1: 'R', h1: 'P' }),
    options: [
      { id: 'rook', piece: 'R' },
      { id: 'pawn', piece: 'P' },
    ],
    answer: 'rook',
    ...overrides,
  };
}

/** Rook on a1: a best-move exercise solved by moving the rook to a8. */
export function validBestMoveExercise(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: 'demo-01',
    type: 'best-move',
    text: 'demo-01',
    board: diagram({ a1: 'R' }),
    solutions: ['Ra8'],
    ...overrides,
  };
}

/** Empty board: a setup exercise placing one rook on a1. */
export function validSetupExercise(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: 'demo-01',
    type: 'setup',
    text: 'demo-01',
    board: diagram({}),
    target: { board: diagram({ a1: 'R' }) },
    ...overrides,
  };
}

/** Pawn on e4 (own pawn on d5, enemy pawn on f5): a select-squares exercise deriving attacked-by. */
export function validAttackedByExercise(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: 'demo-01',
    type: 'select-squares',
    text: 'demo-01',
    board: diagram({ e4: 'P', d5: 'P', f5: 'p', g8: 'k', e1: 'K' }),
    derive: 'attacked-by',
    from: 'e4',
    ...overrides,
  };
}

/** White king g1 in check from the black rook on g8, escaping to f1 or h1. */
export function validCheckEscapesExercise(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: 'demo-01',
    type: 'select-squares',
    text: 'demo-01',
    board: diagram({ g1: 'K', f2: 'P', h2: 'P', g8: 'r', a8: 'k' }),
    derive: 'check-escapes',
    ...overrides,
  };
}

/** Two rooks (b1, d1) plus Ra7 cutting off the 7th rank: either rook mates the lone black king. */
export function validMateInOneExercise(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: 'demo-01',
    type: 'mate-in-n',
    text: 'demo-01',
    board: diagram({ h8: 'k', a7: 'R', b1: 'R', d1: 'R', g2: 'K' }),
    n: 1,
    line: ['Rb8#'],
    ...overrides,
  };
}

/** 1.Ne7+ Kh8 2.Qa8# — a mate-in-2 with a scripted opponent reply. */
export function validMateInTwoExercise(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: 'demo-01',
    type: 'mate-in-n',
    text: 'demo-01',
    board: diagram({ g8: 'k', f7: 'p', g7: 'p', h7: 'p', c6: 'N', a1: 'Q', b1: 'K' }),
    n: 2,
    line: ['Ne7+', 'Kh8', 'Qa8#'],
    ...overrides,
  };
}

/**
 * Black king a8, white king b6, white queen d5: `Qb7#` mates, but `Qxa8`/`Qd6`/`Qe5` each stalemate
 * instead — a "don't stalemate" mate-in-1 with `trap: stalemate`.
 */
export function validMateInOneWithStalemateTrapExercise(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: 'demo-01',
    type: 'mate-in-n',
    text: 'demo-01',
    board: diagram({ a8: 'k', b6: 'K', d5: 'Q' }),
    n: 1,
    line: ['Qb7#'],
    trap: 'stalemate',
    ...overrides,
  };
}

/** A black pawn on e4, attacked by the white pawn on d3 and undefended: a "hanging" yes-no exercise. */
export function validYesNoHangingExercise(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: 'demo-01',
    type: 'yes-no',
    text: 'demo-01',
    board: diagram({ e4: 'p', d3: 'P', a1: 'K', h8: 'k' }),
    answer: 'yes',
    focus: 'e4',
    verify: 'hanging e4',
    ...overrides,
  };
}

/** Rook vs. queen options: a "higher-value" choice exercise (queen is worth more). */
export function validChoiceHigherValueExercise(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: 'demo-01',
    type: 'choice',
    text: 'demo-01',
    board: diagram({ a1: 'R' }),
    options: [
      { id: 'rook', piece: 'R' },
      { id: 'queen', piece: 'Q' },
    ],
    answer: 'queen',
    verify: 'higher-value',
    ...overrides,
  };
}

/** Knight g1, enemy rook e5: only Nf3 newly attacks e5 (Ne2/Nh3 don't). */
export function validAttackVerifyExercise(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: 'demo-01',
    type: 'best-move',
    text: 'demo-01',
    board: diagram({ g1: 'N', e5: 'r' }),
    solutions: ['Nf3'],
    verify: 'attack e5',
    ...overrides,
  };
}

/** Knight a1 attacked (undefended) by the rook on a8: either escape (Nb3/Nc2) saves it. */
export function validSaveVerifyExercise(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: 'demo-01',
    type: 'best-move',
    text: 'demo-01',
    board: diagram({ a1: 'N', a8: 'r' }),
    solutions: ['Nb3', 'Nc2'],
    verify: 'save a1',
    ...overrides,
  };
}

/**
 * Rook a1: an undefended pawn on a8 and a knight-defended pawn on h1 — only Rxa8 is take-free.
 * (Not a bishop on g2: that square sits on the same a8-h1 diagonal, so it would defend both ends.)
 */
export function validTakeFreeVerifyExercise(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: 'demo-01',
    type: 'best-move',
    text: 'demo-01',
    board: diagram({ a1: 'R', a8: 'p', h1: 'p', f2: 'n' }),
    solutions: ['Rxa8'],
    verify: 'take-free',
    ...overrides,
  };
}

/**
 * Rook a1: an undefended queen on a8 (good trade regardless) and a knight-defended rook on h1
 * (equal value, defended: not a good trade). See `validTakeFreeVerifyExercise` on why a knight,
 * not a bishop, defends h1 here.
 */
export function validGoodTradeVerifyExercise(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: 'demo-01',
    type: 'best-move',
    text: 'demo-01',
    board: diagram({ a1: 'R', a8: 'q', h1: 'r', f2: 'n' }),
    solutions: ['Rxa8'],
    verify: 'good-trade',
    ...overrides,
  };
}

/** Rook a1, black king e7: only Ra7 and Re1 give check (same rank / file as the king). */
export function validCheckVerifyExercise(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: 'demo-01',
    type: 'best-move',
    text: 'demo-01',
    board: diagram({ a1: 'R', e7: 'k' }),
    solutions: ['Ra7', 'Re1'],
    verify: 'check',
    ...overrides,
  };
}

/**
 * White king e1 in check from the black rook on e8 (e-file): king can step to d1/d2/f1/f2
 * (`escape-king`), the rook on b4 or the knight on d6 can interpose on e4 (`escape-block`), or the
 * knight can capture the checking rook, Nxe8 (`escape-capture`). Neither white piece attacks the
 * black king on a8, so the start position itself is not already giving black an illegal check.
 */
export function validEscapeCheckVerifyExercise(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: 'demo-01',
    type: 'best-move',
    text: 'demo-01',
    board: diagram({ e1: 'K', b4: 'R', d6: 'N', e8: 'r', a8: 'k' }),
    solutions: ['Kd1', 'Kd2', 'Kf1', 'Kf2'],
    verify: 'escape-king',
    ...overrides,
  };
}

/** Rook vs. queen options: a "worth 9" choice exercise (only the queen is worth 9). */
export function validChoiceWorthExercise(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: 'demo-01',
    type: 'choice',
    text: 'demo-01',
    board: diagram({ a1: 'R' }),
    options: [
      { id: 'rook', piece: 'R' },
      { id: 'queen', piece: 'Q' },
    ],
    answer: 'queen',
    verify: 'worth 9',
    ...overrides,
  };
}

/** Rook a1 capturing the queen on h1: a "good" trade (queen worth more than the rook). */
export function validChoiceTradeExercise(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: 'demo-01',
    type: 'choice',
    text: 'demo-01',
    board: diagram({ a1: 'R', h1: 'q' }),
    options: [
      { id: 'good', text: 'demo-01' },
      { id: 'equal', text: 'demo-01' },
      { id: 'bad', text: 'demo-01' },
    ],
    answer: 'good',
    verify: 'trade Rxh1',
    ...overrides,
  };
}

/**
 * White king e1, rooks a1/h1, both castling rights, black king far away on e8: both `O-O` and
 * `O-O-O` are legal right now (M4.1 `castle` verify).
 */
export function validCastleVerifyExercise(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: 'demo-01',
    type: 'best-move',
    text: 'demo-01',
    fen: '4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1',
    solutions: ['O-O', 'O-O-O'],
    verify: 'castle',
    ...overrides,
  };
}

/**
 * White pawn e5, black pawn d5 (just double-stepped from d7, en passant square d6): `exd6` is the
 * only legal en passant capture (M4.1 `en-passant` verify).
 */
export function validEnPassantVerifyExercise(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: 'demo-01',
    type: 'best-move',
    text: 'demo-01',
    fen: '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1',
    solutions: ['exd6'],
    verify: 'en-passant',
    ...overrides,
  };
}

/** Same castling position as `validCastleVerifyExercise`, asked as a yes-no about kingside rights. */
export function validCanCastleVerifyExercise(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: 'demo-01',
    type: 'yes-no',
    text: 'demo-01',
    fen: '4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1',
    answer: 'yes',
    focus: 'e1',
    verify: 'can-castle kingside',
    ...overrides,
  };
}

/** Same en passant position as `validEnPassantVerifyExercise`, asked as a yes-no. */
export function validCanEnPassantVerifyExercise(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: 'demo-01',
    type: 'yes-no',
    text: 'demo-01',
    fen: '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1',
    answer: 'yes',
    focus: 'e5',
    verify: 'can-en-passant',
    ...overrides,
  };
}

/** Lone kings: a dead draw by material (M4.1 `insufficient-material` verify). */
export function validInsufficientMaterialVerifyExercise(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: 'demo-01',
    type: 'yes-no',
    text: 'demo-01',
    board: diagram({ e1: 'K', e8: 'k' }),
    answer: 'yes',
    verify: 'insufficient-material',
    ...overrides,
  };
}

/** Textbook stalemate (queen b8, kings f2/h1, black to move): a `draw-kind` choice exercise. */
export function validDrawKindExercise(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: 'demo-01',
    type: 'choice',
    text: 'demo-01',
    board: diagram({ b8: 'Q', f2: 'K', h1: 'k' }),
    toMove: 'b',
    options: [
      { id: 'stalemate', text: 'demo-01' },
      { id: 'insufficient-material', text: 'demo-01' },
      { id: 'not-a-draw', text: 'demo-01' },
    ],
    answer: 'stalemate',
    verify: 'draw-kind',
    ...overrides,
  };
}

export function validLesson(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'demo-lesson',
    world: 'w1',
    order: 1,
    concept: 'c1',
    character: 'char1',
    title: 'demo-lesson.title',
    story: 'demo-lesson.story',
    demo: {
      board: diagram({ d4: 'R' }),
      text: 'demo-demo',
      highlight: 'legal-moves d4',
    },
    guided: [],
    exercises: [validExercise()],
    ...overrides,
  };
}

/** Rook on a1, one pawn on f1: capture solvable in exactly 1 move. */
export function validMiniGame(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'mg1',
    concept: 'c1',
    unlockAfter: 'demo-lesson',
    title: 'mg1.title',
    goal: 'mg1.goal',
    board: diagram({ a1: 'R', f1: 'p' }),
    par: 1,
    moveLimit: 5,
    ...overrides,
  };
}

export function writeLesson(overrides: Record<string, unknown> = {}): void {
  write('lessons/w1/demo-lesson.yaml', stringify(validLesson(overrides)));
}

export function writeMiniGame(overrides: Record<string, unknown> = {}): void {
  write('minigames/mg1.yaml', stringify(validMiniGame(overrides)));
}

/** Kingless 2-pawns-each `versus` mini-game vs. Mouse: not already over, kid to move, white. */
export function validVersusMiniGame(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: 'vg1',
    concept: 'c1',
    unlockAfter: 'demo-lesson',
    mode: 'versus',
    title: 'vg1.title',
    goal: 'vg1.goal',
    board: diagram({ a2: 'P', h2: 'P', a7: 'p', h7: 'p' }),
    rules: {
      kings: false,
      noMoves: 'lose',
      win: { kid: ['promote', 'capture-all'], opponent: ['promote', 'capture-all'] },
    },
    opponent: { bot: 1 },
    par: 6,
    ...overrides,
  };
}

export function writeVersusMiniGame(overrides: Record<string, unknown> = {}): void {
  write('minigames/vg1.yaml', stringify(validVersusMiniGame(overrides)));
}

export function writeDefaultLocales(): void {
  write(
    'locales/en/lessons.yaml',
    stringify({
      'demo-lesson': { title: 'Title', story: 'Story' },
      'demo-demo': 'Demo',
      'demo-01': 'Exercise',
      'choice-opt-a': 'Option A',
      mg1: { title: 'Title', goal: 'Goal' },
      vg1: { title: 'VTitle', goal: 'VGoal' },
    }),
  );
  write('locales/en/characters.yaml', stringify({ char1: { name: 'Char' } }));
}

export function load(): void {
  const locales = loadLocales(join(dir, 'locales'));
  loadContent(join(dir, 'lessons'), join(dir, 'minigames'), locales);
}

export function issuesOf(): string[] {
  try {
    load();
    return [];
  } catch (error) {
    if (error instanceof ContentError) return [...error.issues];
    throw error;
  }
}
