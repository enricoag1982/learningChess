import type { Page } from '@playwright/test';
import type {
  BestMoveDef,
  ChoiceDef,
  Color,
  CompiledContent,
  ExerciseDef,
  Lesson,
  MateInNDef,
  MiniGame,
  Move,
  Piece,
  PieceType,
  Position,
  SelectSquaresDef,
  SetupDef,
  Square,
  TracksCatalog,
  VariantRules,
  VersusMiniGame,
  YesNoDef,
} from '@chess-kids/core';
import {
  chessJsRules,
  createVariantRules,
  selectSquaresAnswer as coreSelectSquaresAnswer,
  SQUARES,
  solve,
  worldLessons,
} from '@chess-kids/core';
// Node's ESM loader requires this attribute for a JSON import; the content build validates the
// shape (see `bundled-content-source.ts`), so the cast below is a type conversion, not a check.
import rawContent from '@chess-kids/content/content.json' with { type: 'json' };
import rawLocale from '@chess-kids/content/locales/en.json' with { type: 'json' };

const content = rawContent as unknown as CompiledContent;
export const rules: VariantRules = createVariantRules(chessJsRules);

/** A locale namespace as compiled by `packages/content` (nested string tree). */
type LocaleTree = { readonly [key: string]: LocaleTree | string };
const locale = rawLocale as unknown as Record<string, LocaleTree>;

/**
 * Resolves a content text key (e.g. `lessons:rook.title`, `characters:rhino.name`, or a
 * namespace-less `piece.r`, resolved against the `common` default namespace) against the real
 * compiled English strings — the same text the app renders via `tContent`/`t()`. Playwright runs
 * outside React/i18next, so exercise solvers that need to match rendered text (choice options,
 * setup palette buttons) resolve it this way instead of hard-coding English copy.
 */
export function contentText(key: string): string {
  const separatorIndex = key.indexOf(':');
  const namespace = separatorIndex < 0 ? 'common' : key.slice(0, separatorIndex);
  const path = separatorIndex < 0 ? key : key.slice(separatorIndex + 1);
  let node: LocaleTree | string | undefined = locale[namespace];
  for (const segment of path.split('.')) {
    if (typeof node !== 'object') return key;
    node = node[segment];
  }
  return typeof node === 'string' ? node : key;
}

/** Escapes regex metacharacters so `text` can be embedded literally in a `RegExp` source. */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * True for a lesson the Owl teaches directly, not yet tied to one piece (docs/app-structure.md:
 * Owl is the guide/narrator). Every other lesson's `character` stands for one piece
 * (`character-meta.ts`'s map, which this e2e helper doesn't duplicate).
 */
export function isOwlTaught(lesson: Lesson): boolean {
  return lesson.character === 'owl';
}

/**
 * True for an exercise/guided-try type that moves one piece across the board (has a slide
 * animation). `best-move` is deliberately excluded: unlike collect-stars/capture, a wrong attempt
 * there bounces back without changing the position (nothing to undo), so `exercise-play-area.tsx`
 * shows no Undo button or moves counter for it — only `firstMoveOf`-style single-move solving.
 */
export function isMoveCountedExercise(def: ExerciseDef): boolean {
  return def.type === 'collect-stars' || def.type === 'capture';
}

/** True for a type whose solved position is reached by playing exactly one piece move (a slide or
 * bounce-back animation): `collect-stars`/`capture` (via a solver line) plus `best-move`. */
export function movesAPiece(def: ExerciseDef): boolean {
  return isMoveCountedExercise(def) || def.type === 'best-move';
}

/** Replaces every `{{key}}` in a compiled text template with `String(vars[key])`. */
export function interpolate(
  template: string,
  vars: Readonly<Record<string, string | number>>,
): string {
  return Object.entries(vars).reduce(
    (text, [key, value]) => text.replaceAll(`{{${key}}}`, String(value)),
    template,
  );
}

/**
 * A lesson's plain display label — its title when Owl-taught, else its character's name — same as
 * `JourneyScreen`'s `characterLabel`, and the `name` `activateLesson` puts in the Journey's
 * "Finish X first!" message.
 */
export function lessonLabel(lesson: Lesson): string {
  return isOwlTaught(lesson)
    ? contentText(lesson.titleKey)
    : contentText(`characters:${lesson.character}.name`);
}

/**
 * Accessible name of a lesson's Journey node for `status` (matches `JourneyScreen`'s
 * `LessonNode`). For a piece lesson, the piece word is wildcarded: only app UI code
 * (`character-meta.ts`) maps character -> piece, which this e2e helper doesn't duplicate.
 */
export function journeyNodeName(lesson: Lesson, status: 'current' | 'locked'): RegExp {
  const statusWord = escapeRegExp(contentText(`journey:ui.status-${status}`));
  const label = escapeRegExp(lessonLabel(lesson));
  const namePart = isOwlTaught(lesson) ? label : `${label} the .+`;
  const pattern = contentText('journey:ui.node-name')
    .replace('{{name}}', namePart)
    .replace('{{status}}', statusWord);
  return new RegExp(`^${pattern}$`);
}

/**
 * A world's own tab button on the Journey map (`JourneyScreen`'s `WorldRow`: `"<order> <title>"`,
 * e.g. `"4 Check & Mate"`). The Journey defaults to whichever world `journey.nextStep` currently
 * points to (`defaultWorldId`), which is the world holding its own unwon world boss — not
 * necessarily the next world's first lesson — so a spec walking lesson to lesson across a world
 * boundary must click this explicitly instead of assuming the right map is already showing.
 */
export function worldTabName(catalog: TracksCatalog, worldId: string): RegExp {
  for (const track of catalog.tracks) {
    const world = track.worlds.find((entry) => entry.id === worldId);
    if (world !== undefined) {
      // Anchored on the order digit a kid never sees written out (`"1 Board"`, `"4 Check & Mate"`):
      // the title alone can also match an unrelated lesson node's own name (e.g. "Setting Up the
      // Board, locked" contains "Board" too).
      return new RegExp(`^${String(world.order)} ${escapeRegExp(contentText(world.titleKey))}`);
    }
  }
  throw new Error(`worldTabName: world "${worldId}" not found in the tracks catalog`);
}

/** A world's own boss mini-game (`World.boss`, distinct from any lesson's own `boss`), if it has one. */
export function worldBossMiniGame(catalog: TracksCatalog, worldId: string): MiniGame | undefined {
  for (const track of catalog.tracks) {
    const world = track.worlds.find((entry) => entry.id === worldId);
    if (world !== undefined) {
      return world.boss === undefined ? undefined : findMiniGame(world.boss);
    }
  }
  return undefined;
}

/** The Journey's "Finish X first!" message for the lesson right before a locked one. */
export function finishFirstMessage(previousLesson: Lesson): string {
  return interpolate(contentText('journey:ui.finish-first'), { name: lessonLabel(previousLesson) });
}

/** Home's Owl greeting for a freshly offered (not resumed, not all-done) lesson (`HomeScreen`). */
export function homeGreeting(lesson: Lesson): string {
  return isOwlTaught(lesson)
    ? interpolate(contentText('home.owl-next-topic'), { topic: contentText(lesson.titleKey) })
    : interpolate(contentText('home.owl-next'), {
        character: contentText(`characters:${lesson.character}.name`),
      });
}

/**
 * Every lesson of the main track, in Journey/session order (worlds sorted by `order`, each
 * world's lessons via `worldLessons`). Branch tracks are left out: they only ever open once the
 * whole main track is mastered, well past anything these specs need.
 */
export function lessonsInJourneyOrder(
  catalog: TracksCatalog,
  lessons: readonly Lesson[],
): readonly Lesson[] {
  const mainTrack = catalog.tracks.find((track) => track.kind === 'main');
  if (!mainTrack) throw new Error('lessonsInJourneyOrder: catalog has no main track');
  return mainTrack.worlds
    .slice()
    .sort((a, b) => a.order - b.order)
    .flatMap((world) => worldLessons(world, lessons));
}

/**
 * The single seeded profile's id, read straight from localStorage's real storage shape (the same
 * one the app itself writes) — for specs that seed progress directly instead of playing through it.
 */
export async function getSoleProfileId(page: Page): Promise<string> {
  return page.evaluate(() => {
    const raw = localStorage.getItem('chess-kids:profiles');
    const profiles = raw ? (JSON.parse(raw) as Record<string, { id: string }>) : {};
    const [profile] = Object.values(profiles);
    if (!profile) throw new Error('no seeded profile found in localStorage');
    return profile.id;
  });
}

/** One (of possibly several) seeded profile's id, found by its `nickname` — same storage shape as `getSoleProfileId`. */
export async function getProfileIdByNickname(page: Page, nickname: string): Promise<string> {
  return page.evaluate((name) => {
    const raw = localStorage.getItem('chess-kids:profiles');
    const profiles = raw
      ? (JSON.parse(raw) as Record<string, { id: string; nickname: string }>)
      : {};
    const profile = Object.values(profiles).find((candidate) => candidate.nickname === name);
    if (!profile) throw new Error(`no seeded profile named "${name}" found in localStorage`);
    return profile.id;
  }, nickname);
}

/**
 * Seeds one lesson's progress directly into localStorage (same real storage key/shape the app
 * itself writes), marking it mastered: every exercise at 3 stars, and — for a lesson with a boss —
 * the boss "won" at 3 stars. Used to unlock a later world/lesson from the Journey without playing
 * through everything before it.
 */
export async function seedLessonMastered(
  page: Page,
  profileId: string,
  lesson: Lesson,
): Promise<void> {
  await page.evaluate(
    ({ profileId: pid, lessonId, exerciseIds, hasBoss }) => {
      const key = 'chess-kids:lesson-progress';
      const raw = localStorage.getItem(key);
      const all = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      const now = new Date().toISOString();
      all[`${pid}:${lessonId}`] = {
        id: `seed-${lessonId}`,
        profileId: pid,
        lessonId,
        bestStars: Object.fromEntries(exerciseIds.map((id) => [id, 3])),
        bossStars: hasBoss ? 3 : 0,
        resumeStep: 0,
        createdAt: now,
        updatedAt: now,
      };
      localStorage.setItem(key, JSON.stringify(all));
    },
    {
      profileId,
      lessonId: lesson.id,
      exerciseIds: lesson.exercises.map((exercise) => exercise.id),
      hasBoss: lesson.boss !== undefined,
    },
  );
}

/**
 * Seeds a world boss's own `MiniGameProgress` record (won, 3 stars) — the separate "played
 * standalone" record (`docs/domain-model.md` §2/§3) a world boss needs, on top of its
 * `LessonProgress.bossStars`, before `worldStatus`/`trackStatus` will call that world "mastered".
 * Needed to reach a later world (e.g. World 4) via `seedLessonsMastered` alone: a world with its own
 * `boss` (e.g. World 3's `win-the-queen`) is not "mastered" — and so does not unlock the next world
 * on the Journey map — until this is seeded too, even though every one of its lessons is.
 */
export async function seedMiniGameWon(
  page: Page,
  profileId: string,
  miniGameId: string,
): Promise<void> {
  await page.evaluate(
    ({ profileId: pid, miniGameId }) => {
      const key = 'chess-kids:minigame-progress';
      const raw = localStorage.getItem(key);
      const all = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      const now = new Date().toISOString();
      all[`${pid}:${miniGameId}`] = {
        id: `seed-${miniGameId}`,
        profileId: pid,
        miniGameId,
        bestStars: 3,
        plays: 1,
        wins: 1,
        createdAt: now,
        updatedAt: now,
      };
      localStorage.setItem(key, JSON.stringify(all));
    },
    { profileId, miniGameId },
  );
}

/**
 * Seeds `count` full-game wins vs `opponentLevel` (same real storage shape as
 * `LocalStorageGameRecordRepository`: a flat, append-only `GameRecord[]`) — used to unlock a
 * higher computer level without playing every prerequisite game through the UI (M4.2,
 * `docs/computer-opponent.md` §3: 3 full-game wins vs the level right below unlocks the next one).
 */
export async function seedGameRecordWins(
  page: Page,
  profileId: string,
  opponentLevel: number,
  count: number,
): Promise<void> {
  await page.evaluate(
    ({ profileId: pid, opponentLevel, count }) => {
      const key = 'chess-kids:game-records';
      const raw = localStorage.getItem(key);
      const all: unknown[] = raw ? (JSON.parse(raw) as unknown[]) : [];
      const now = new Date();
      for (let i = 0; i < count; i += 1) {
        now.setSeconds(now.getSeconds() + 1);
        all.push({
          id: `seed-win-${String(opponentLevel)}-${String(i)}`,
          profileId: pid,
          game: 'full',
          opponent: `computer:${String(opponentLevel)}`,
          result: 'win',
          reason: 'checkmate',
          moves: ['e4', 'e5'],
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        });
      }
      localStorage.setItem(key, JSON.stringify(all));
    },
    { profileId, opponentLevel, count },
  );
}

/**
 * Seeds one lesson's progress with explicit `bestStars` and `resumeStep` (same real storage
 * key/shape as `seedLessonMastered`), for a spec that needs to land mid-lesson — e.g. right at a
 * scored exercise that offers an easier variant — instead of at a freshly mastered or brand-new one.
 */
export async function seedLessonProgress(
  page: Page,
  profileId: string,
  lesson: Lesson,
  bestStars: Readonly<Record<string, 1 | 2 | 3>>,
  resumeStep: number,
): Promise<void> {
  await page.evaluate(
    ({ profileId: pid, lessonId, bestStars, resumeStep }) => {
      const key = 'chess-kids:lesson-progress';
      const raw = localStorage.getItem(key);
      const all = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      const now = new Date().toISOString();
      all[`${pid}:${lessonId}`] = {
        id: `seed-${lessonId}`,
        profileId: pid,
        lessonId,
        bestStars,
        bossStars: 0,
        resumeStep,
        createdAt: now,
        updatedAt: now,
      };
      localStorage.setItem(key, JSON.stringify(all));
    },
    { profileId, lessonId: lesson.id, bestStars, resumeStep },
  );
}

/** Reads one lesson's saved `bestStars` straight from localStorage's real storage shape, or `{}` if the lesson has no saved progress yet. */
export async function readLessonBestStars(
  page: Page,
  profileId: string,
  lessonId: string,
): Promise<Readonly<Record<string, number>>> {
  return page.evaluate(
    ({ profileId: pid, lessonId }) => {
      const raw = localStorage.getItem('chess-kids:lesson-progress');
      const all = raw
        ? (JSON.parse(raw) as Record<string, { bestStars?: Record<string, number> }>)
        : {};
      return all[`${pid}:${lessonId}`]?.bestStars ?? {};
    },
    { profileId, lessonId },
  );
}

/** `seedLessonMastered` for every lesson in `lessons` (order doesn't matter, each is independent). */
export async function seedLessonsMastered(
  page: Page,
  profileId: string,
  lessons: readonly Lesson[],
): Promise<void> {
  for (const lesson of lessons) {
    await seedLessonMastered(page, profileId, lesson);
  }
}

/**
 * Seeds every lesson through World 4 ("check") mastered, plus World 3's and World 4's own world
 * bosses won (`win-the-queen`, `first-game`) — the same ingredients `world4.spec.ts` seeds by hand,
 * bundled here for specs that only need "World 4 mastered" as a starting point (M4.3's vs Friend:
 * unlocks the full game, and, from earlier worlds, Pawn Wars and Win the Queen too).
 */
export async function seedWorldFourMastered(
  page: Page,
  profileId: string,
  catalog: TracksCatalog,
  lessons: readonly Lesson[],
): Promise<void> {
  const basics = catalog.tracks.find((track) => track.id === 'basics');
  if (!basics) throw new Error('seedWorldFourMastered: "basics" track not found');
  const checkWorld = basics.worlds.find((world) => world.id === 'check');
  if (!checkWorld) throw new Error('seedWorldFourMastered: "check" world not found');

  const worldIds = new Set(
    basics.worlds.filter((world) => world.order <= checkWorld.order).map((world) => world.id),
  );
  await seedLessonsMastered(
    page,
    profileId,
    lessons.filter((lesson) => worldIds.has(lesson.world)),
  );
  await seedMiniGameWon(page, profileId, 'win-the-queen');
  await seedMiniGameWon(page, profileId, 'first-game');
}

/**
 * Seeds one concept's review state directly into localStorage (same real storage key/shape
 * `LocalStorageProgressRepository` writes), due now by default — the M3.4 Leitner scheduler's
 * `ConceptStats`. Used to put a concept in today's warm-up / Practice's due count without playing
 * an exercise wrong first.
 */
export async function seedConceptStats(
  page: Page,
  profileId: string,
  conceptId: string,
  overrides: Partial<{
    readonly box: 1 | 2 | 3 | 4 | 5;
    readonly dueAt: string;
    readonly recent: readonly boolean[];
  }> = {},
): Promise<void> {
  await page.evaluate(
    ({ profileId: pid, conceptId, overrides }) => {
      const key = 'chess-kids:concept-stats';
      const raw = localStorage.getItem(key);
      const all = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      const now = new Date().toISOString();
      all[`${pid}:${conceptId}`] = {
        id: `seed-${conceptId}`,
        profileId: pid,
        conceptId,
        recent: overrides.recent ?? [],
        box: overrides.box ?? 1,
        dueAt: overrides.dueAt ?? now,
        createdAt: now,
        updatedAt: now,
      };
      localStorage.setItem(key, JSON.stringify(all));
    },
    { profileId, conceptId, overrides },
  );
}

export function findLesson(id: string): Lesson {
  const lesson = content.lessons.find((entry) => entry.id === id);
  if (!lesson) throw new Error(`fixture content is missing lesson "${id}"`);
  return lesson;
}

export function findMiniGame(id: string): MiniGame {
  const game = content.minigames.find((entry) => entry.id === id);
  if (!game) throw new Error(`fixture content is missing mini-game "${id}"`);
  return game;
}

/** Answer squares for a select-squares exercise (`answer`, or any `derive` kind), via core. */
export function selectSquaresAnswer(def: SelectSquaresDef): readonly Square[] {
  return coreSelectSquaresAnswer(def, rules);
}

/** Clicks the board cell named "<square>, ..." (Board.tsx's accessible square names). */
export async function clickSquare(page: Page, square: string): Promise<void> {
  await page.getByRole('button', { name: new RegExp(`^${square},`) }).click();
}

/** Plays a shortest solve line (collect-stars / capture) computed by the core solver. */
export async function playSolveLine(
  page: Page,
  position: Position,
  goal: 'collect-stars' | 'capture',
): Promise<void> {
  const line = solve(position, rules, goal);
  if (!line) throw new Error('no solution found by the core solver');
  for (const move of line) {
    await clickSquare(page, move.from);
    await clickSquare(page, move.to);
  }
}

/** Answers a yes-no exercise by clicking the correct button (Yes/No, translated). */
async function solveYesNo(page: Page, def: YesNoDef): Promise<void> {
  const label = def.answer ? contentText('exercise.yes') : contentText('exercise.no');
  await page.getByRole('button', { name: label, exact: true }).click();
}

/** Picks the correct option of a choice exercise, by its rendered text or piece aria-label. */
async function solveChoice(page: Page, def: ChoiceDef): Promise<void> {
  const option = def.options.find((entry) => entry.id === def.answer);
  if (!option) throw new Error(`choice exercise "${def.id}" has no option matching its answer`);
  if (option.textKey !== undefined) {
    await page.getByRole('button', { name: contentText(option.textKey), exact: true }).click();
    return;
  }
  if (!option.piece)
    throw new Error(`choice exercise "${def.id}" option has neither text nor piece`);
  const color = contentText(`board.color.${option.piece.color}`);
  const piece = contentText(`board.piece.${option.piece.type}`);
  await page.getByRole('button', { name: `${color} ${piece}`, exact: true }).click();
}

/** Plays the first winning SAN in `solutions`, found via the core rules' legal moves. */
async function solveBestMove(page: Page, def: BestMoveDef): Promise<void> {
  const [san] = def.solutions;
  if (!san) throw new Error(`best-move exercise "${def.id}" has no solutions`);
  const moves = rules.legalMoves(def.position, { staticOpponent: true });
  // Normalized (check/mate marks stripped), same as the engine's own SAN comparison
  // (`engine.ts`'s `isSolutionMove`): a `verify: check`/`escape-*` solution (M3.3) is always a
  // checking move, so chess.js's own SAN for it always carries a "+"/"#" the authored SAN may not.
  const move = moves.find((candidate) => normalizeSan(candidate.san) === normalizeSan(san));
  if (!move) throw new Error(`best-move exercise "${def.id}": no legal move matches SAN "${san}"`);
  await clickSquare(page, move.from);
  await clickSquare(page, move.to);
}

/** Places every target piece missing from the starting position, via the setup palette + board. */
async function solveSetup(page: Page, def: SetupDef): Promise<void> {
  const missing = SQUARES.filter(
    (square) =>
      def.target.pieces[square] !== undefined && def.position.pieces[square] === undefined,
  );
  for (const square of missing) {
    const piece = def.target.pieces[square];
    if (!piece) continue;
    const color = contentText(`board.color.${piece.color}`);
    const pieceName = contentText(`board.piece.${piece.type}`);
    await page.getByRole('button', { name: new RegExp(`^${color} ${pieceName},`) }).click();
    await clickSquare(page, square);
  }
}

/** Strips a trailing check/mate mark, matching the engine's own SAN comparison (`engine.ts`). */
function normalizeSan(san: string): string {
  return san.replace(/[+#]+$/, '');
}

/**
 * Plays every scripted kid move of a mate-in-n exercise (`playMateInN`'s "moved" outcome mirrored
 * here without the app's state): after each ply with a scripted reply, waits out the reply's
 * ~600ms reveal delay (`ExerciseStep.tsx`) before the board accepts the next kid move.
 */
async function solveMateInN(page: Page, def: MateInNDef): Promise<void> {
  let position = def.position;
  for (let i = 0; i < def.line.length; i += 2) {
    const san = def.line[i];
    if (san === undefined) {
      throw new Error(`mate-in-n exercise "${def.id}": line is missing move ${String(i)}`);
    }
    const candidates = chessJsRules.legalMoves(position);
    const move = candidates.find((candidate) => normalizeSan(candidate.san) === normalizeSan(san));
    if (!move) {
      throw new Error(`mate-in-n exercise "${def.id}": no legal move matches SAN "${san}"`);
    }
    await clickSquare(page, move.from);
    await clickSquare(page, move.to);

    const played = chessJsRules.play(position, san);
    if (!played) {
      throw new Error(`mate-in-n exercise "${def.id}": "${san}" is illegal from this position`);
    }
    position = played.position;

    const replySan = def.line[i + 1];
    if (replySan !== undefined) {
      const repliedPlay = chessJsRules.play(position, replySan);
      if (!repliedPlay) {
        throw new Error(`mate-in-n exercise "${def.id}": scripted reply "${replySan}" is illegal`);
      }
      position = repliedPlay.position;
      await page.waitForTimeout(700);
    }
  }
}

/** Solves any exercise definition's core interaction, leaving it on its success panel. */
export async function solveExercise(page: Page, def: ExerciseDef): Promise<void> {
  switch (def.type) {
    case 'select-squares':
      for (const square of selectSquaresAnswer(def)) {
        await clickSquare(page, square);
      }
      await page.getByRole('button', { name: /Check/ }).click();
      return;
    case 'collect-stars':
    case 'capture':
      await playSolveLine(page, def.position, def.type);
      return;
    case 'yes-no':
      await solveYesNo(page, def);
      return;
    case 'choice':
      await solveChoice(page, def);
      return;
    case 'best-move':
      await solveBestMove(page, def);
      return;
    case 'mate-in-n':
      await solveMateInN(page, def);
      return;
    case 'setup':
      await solveSetup(page, def);
  }
}

/** Solves one guided try or scored exercise, of any type, then advances past its success panel. */
export async function completeExercise(page: Page, def: ExerciseDef): Promise<void> {
  await solveExercise(page, def);
  await page.getByRole('button', { name: /^Next/ }).click();
}

/**
 * Solves whichever of `candidates` is currently on screen, then advances past its success panel;
 * returns the matched definition. For a review task (M3.4 warm-up / Practice), whose exact
 * exercise the app picks at random from a concept's pool — each candidate's own instruction text
 * (never interpolated, so a plain equality match) tells them apart.
 */
export async function solveWhicheverExercise(
  page: Page,
  candidates: readonly ExerciseDef[],
): Promise<ExerciseDef> {
  for (const candidate of candidates) {
    if (await page.getByText(contentText(candidate.textKey), { exact: true }).isVisible()) {
      await completeExercise(page, candidate);
      return candidate;
    }
  }
  throw new Error('solveWhicheverExercise: no candidate instruction text matched what is shown');
}

/** Reverse-lookup maps (rendered English word → chess letter) for `readVersusPieces`. */
const COLOR_WORDS: Readonly<Record<string, Color>> = {
  [contentText('board.color.w')]: 'w',
  [contentText('board.color.b')]: 'b',
};
const PIECE_WORDS: Readonly<Record<string, PieceType>> = {
  [contentText('board.piece.p')]: 'p',
  [contentText('board.piece.n')]: 'n',
  [contentText('board.piece.b')]: 'b',
  [contentText('board.piece.r')]: 'r',
  [contentText('board.piece.q')]: 'q',
  [contentText('board.piece.k')]: 'k',
};

/**
 * Reads the current board straight from the rendered squares' accessible names (Board.tsx's
 * `describeSquare`: `"<square>, <color> <piece>[, <state>]"`), the only way a Playwright spec can
 * see a `versus` boss's position — it evolves live against the real bot, so there is no content
 * definition to read it from partway through, unlike every other exercise type.
 */
async function readVersusPieces(page: Page): Promise<Partial<Record<Square, Piece>>> {
  // One round trip for every square's aria-label (`page.evaluate`), not 64 (one `getAttribute`
  // each) — the difference between a `versus` boss finishing in seconds or in minutes, since this
  // runs once per kid move for as long as the game against the bot lasts.
  const labels = await page.evaluate(() =>
    [...document.querySelectorAll('[role="gridcell"] button')].map((element) =>
      element.getAttribute('aria-label'),
    ),
  );
  const pieces: Partial<Record<Square, Piece>> = {};
  for (const label of labels) {
    // `\w+` (not `\S+`): a danger/selected/etc. suffix follows as ", in danger" — a comma right
    // after the piece word, which `\S+` would swallow (e.g. "pawn," failing every colour/piece
    // lookup below and silently dropping that square, exactly the pieces a versus boss most
    // needs — its own attacked, undefended ones).
    const match = label === null ? null : /^([a-h][1-8]), (\w+) (\w+)/.exec(label);
    if (match === null) continue;
    const [, square, colorWord, pieceWord] = match;
    const color = colorWord === undefined ? undefined : COLOR_WORDS[colorWord];
    const type = pieceWord === undefined ? undefined : PIECE_WORDS[pieceWord];
    if (square !== undefined && color !== undefined && type !== undefined) {
      pieces[square as Square] = { color, type };
    }
  }
  return pieces;
}

/** Ranks advanced toward promotion (0 = still on the back rank). */
function pawnAdvance(move: Move, color: Color): number {
  const rank = Number(move.to[1]);
  return color === 'w' ? rank - 1 : 8 - rank;
}

/** True when no enemy pawn attacks `move.to` once `move` is played. */
function isSafeAfter(position: Position, move: Move, kidColor: Color): boolean {
  const played = chessJsRules.play(position, move);
  if (played === null) return false;
  const opponent: Color = kidColor === 'w' ? 'b' : 'w';
  return chessJsRules.attackers(played.position, move.to, opponent).length === 0;
}

/**
 * The e2e kid policy for a `versus` boss (Pawn Wars): capture if possible, else push the most
 * advanced pawn that stays safe (no enemy pawn would then attack it), else any legal move.
 */
function chooseKidVersusMove(
  pieces: Partial<Record<Square, Piece>>,
  kidColor: Color,
): { readonly from: Square; readonly to: Square } {
  const position: Position = {
    pieces,
    markers: { stars: [], blocked: [] },
    toMove: kidColor,
    castling: '-',
    enPassant: null,
  };
  const legalMoves = chessJsRules.legalMoves(position);
  const capture = legalMoves.find((move) => move.captured !== undefined);
  if (capture !== undefined) return capture;

  const byAdvance = [...legalMoves].sort(
    (a, b) => pawnAdvance(b, kidColor) - pawnAdvance(a, kidColor),
  );
  const safe = byAdvance.find((move) => isSafeAfter(position, move, kidColor));
  const chosen = safe ?? byAdvance[0];
  if (chosen === undefined) {
    throw new Error('chooseKidVersusMove: no legal move for the kid');
  }
  return chosen;
}

/** Blocks until the versus panel shows the kid's turn, or the game has ended either way. */
export async function waitForVersusTurnOrEnd(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const panel = document.querySelector('[data-versus-status]');
      if (panel === null) return true;
      const status = panel.getAttribute('data-versus-status');
      const turn = panel.getAttribute('data-versus-turn');
      return status !== 'playing' || turn === 'kid';
    },
    undefined,
    { timeout: 15000 },
  );
}

/**
 * Plays exactly one kid move in a `versus` boss (the a11y walk's mid-game deep scan needs this on
 * its own; `playVersusBoss` below just loops it to the end). Assumes it is already the kid's turn.
 */
export async function playOneKidVersusMove(page: Page, game: VersusMiniGame): Promise<void> {
  const pieces = await readVersusPieces(page);
  const move = chooseKidVersusMove(pieces, game.kidColor);
  await clickSquare(page, move.from);
  await clickSquare(page, move.to);
}

/**
 * Plays a `versus` boss (Pawn Wars) to its end against the real (seeded or not) bot, using
 * `chooseKidVersusMove` for every kid move. Leaves the page on the result panel, before its
 * "Next" tap (`completeBoss` does that once, for every mini-game mode).
 */
export async function playVersusBoss(page: Page, game: VersusMiniGame): Promise<void> {
  for (;;) {
    await waitForVersusTurnOrEnd(page);
    const status = await page.locator('[data-versus-status]').getAttribute('data-versus-status');
    if (status !== 'playing') return;

    await playOneKidVersusMove(page, game);
  }
}

/**
 * Solves a lesson's boss mini-game, then advances past its result panel. `static` games are
 * solved with the solver line for their goal (`capture-all` or `collect-stars`); `series` games
 * play each round like an exercise, tapping Next between rounds; `versus` games are played out
 * against the real bot via `playVersusBoss`.
 */
export async function completeBoss(page: Page, game: MiniGame): Promise<void> {
  if (game.mode === 'series') {
    for (const round of game.rounds) {
      await solveExercise(page, round);
      await page.getByRole('button', { name: /^Next/ }).click();
    }
  } else if (game.mode === 'versus') {
    await playVersusBoss(page, game);
  } else {
    const goal = game.goal === 'collect-stars' ? 'collect-stars' : 'capture';
    await playSolveLine(page, game.position, goal);
  }
  await page.getByRole('button', { name: /^Next/ }).click();
}

/**
 * Plays a whole lesson end to end from its first guided try (see `startLessonToFirstGuided`):
 * every guided try, every scored exercise (any type), then the boss if the lesson has one.
 * Leaves the page on the lesson's Complete step.
 */
export async function playLesson(
  page: Page,
  lesson: Lesson,
  minigames: readonly MiniGame[],
): Promise<void> {
  for (const guided of lesson.guided) {
    await completeExercise(page, guided);
  }
  for (const exercise of lesson.exercises) {
    await completeExercise(page, exercise);
  }
  if (lesson.boss) {
    const boss = minigames.find((game) => game.id === lesson.boss);
    if (!boss) throw new Error(`playLesson: mini-game "${lesson.boss}" not found`);
    await completeBoss(page, boss);
  }
}

/**
 * Drives a fresh install through first run (Welcome → parent password → Saved → new player) up
 * to Home. Every Playwright test starts with empty browser storage, so specs that just need Home
 * or a lesson call this first instead of `page.goto('/')` directly (`profiles.spec.ts` is the one
 * spec that exercises first run's own screens in detail).
 */
export async function completeFirstRun(page: Page, nickname = 'Kid'): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start setup' }).click();

  await page.getByLabel('Password', { exact: true }).fill('1234');
  await page.getByLabel('Repeat password').fill('1234');
  await page.getByRole('button', { name: 'Save password' }).click();

  await page.getByRole('button', { name: 'Next' }).click(); // Saved -> new player
  await page.getByPlaceholder('Your name').fill(nickname);
  await page.getByRole('button', { name: 'Next' }).click(); // nickname -> avatar
  await page.getByRole('button', { name: "Let's play!" }).click();

  await page.getByRole('heading', { level: 1, name: 'Chess for Kids' }).waitFor();
}

/**
 * Dismisses the M4.4 badge celebration overlay if one is showing (a no-op otherwise) — lesson
 * complete, a game's result and the session summary can each now surface one, and its own
 * "Continue" button shares its text with that same screen's own primary button underneath, so
 * specs call this first to avoid an ambiguous match. Loops (bounded, celebrations cap at 2 per
 * app sitting) since dismissing one can immediately queue a second.
 */
export async function dismissCelebrationIfShown(page: Page): Promise<void> {
  const celebration = page.getByRole('alertdialog', { name: 'New badge!' });
  for (let i = 0; i < 2; i += 1) {
    if (!(await celebration.isVisible().catch(() => false))) return;
    await celebration.getByRole('button', { name: 'Continue' }).click();
  }
}

/**
 * From the profile picker (a parent lock already exists), taps the tile named `nickname` and
 * waits for Home. Every reload shows the picker again (app-structure.md §3), so specs that reload
 * mid-flow call this to get back to Home.
 */
export async function pickProfileFromPicker(page: Page, nickname: string): Promise<void> {
  await page.getByRole('button', { name: new RegExp(nickname) }).click();
  await page.getByRole('heading', { level: 1, name: 'Chess for Kids' }).waitFor();
}

/** From Home, opens today's lesson and advances Story -> Demo -> first guided try. */
export async function startLessonToFirstGuided(page: Page): Promise<void> {
  await completeFirstRun(page);
  await page.getByRole('button', { name: /Start/ }).click();
  await page.getByRole('button', { name: /Let me try/ }).click(); // Story -> Demo
  await page.getByRole('button', { name: /^Next/ }).click(); // Demo -> first guided try
}
