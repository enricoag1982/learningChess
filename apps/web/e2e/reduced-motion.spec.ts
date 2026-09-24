import { expect, test } from '@playwright/test';
import type { CompiledContent, ExerciseDef, Lesson, Square, TracksCatalog } from '@chess-kids/core';
import { createVariantRules, chessJsRules, solve } from '@chess-kids/core';
import rawContent from '@chess-kids/content/content.json' with { type: 'json' };
import rawTracks from '@chess-kids/content/tracks.json' with { type: 'json' };
import {
  clickSquare,
  completeFirstRun,
  completeExercise,
  getSoleProfileId,
  lessonsInJourneyOrder,
  movesAPiece,
  pickProfileFromPicker,
  seedLessonsMastered,
} from './helpers.ts';

const content = rawContent as unknown as CompiledContent;
const catalog = rawTracks as unknown as TracksCatalog;
const rules = createVariantRules(chessJsRules);

interface MoveStep {
  readonly lesson: Lesson;
  readonly def: ExerciseDef;
}

/**
 * The first guided try or scored exercise, in Journey order, whose type moves one piece
 * (collect-stars / capture / best-move) — whichever lesson that turns out to be, so this spec
 * survives future content (World 1 today has none of these; the Rook lesson's first guided try is
 * the first).
 */
function firstPieceMoveStep(): MoveStep {
  for (const lesson of lessonsInJourneyOrder(catalog, content.lessons)) {
    const def = [...lesson.guided, ...lesson.exercises].find(movesAPiece);
    if (def) return { lesson, def };
  }
  throw new Error('bundled content: no guided try or exercise moves a piece');
}

/** Every lesson strictly before `target` in Journey order (main track only). */
function lessonsBefore(target: Lesson): readonly Lesson[] {
  const ordered = lessonsInJourneyOrder(catalog, content.lessons);
  const index = ordered.findIndex((lesson) => lesson.id === target.id);
  return ordered.slice(0, index);
}

/** The first move of `def`'s solution: the shortest solver line for a move-counted goal, or the
 * first listed solution's move for `best-move`. */
function firstMoveOf(def: ExerciseDef): { readonly from: Square; readonly to: Square } {
  if (def.type === 'collect-stars' || def.type === 'capture') {
    const line = solve(def.position, rules, def.type);
    const [move] = line ?? [];
    if (!move) throw new Error(`exercise "${def.id}": no solver line found`);
    return move;
  }
  if (def.type === 'best-move') {
    const [san] = def.solutions;
    const move = rules
      .legalMoves(def.position, { staticOpponent: true })
      .find((candidate) => candidate.san === san);
    if (!move) throw new Error(`exercise "${def.id}": no legal move matches SAN "${san ?? ''}"`);
    return move;
  }
  throw new Error(`exercise "${def.id}": type "${def.type}" doesn't move a single piece`);
}

// non-functional.md §2: "Respect reduce motion." index.css zeroes animation/transition durations
// globally under `prefers-reduced-motion: reduce`, so a played move should land immediately
// instead of visibly sliding.
test.use({ reducedMotion: 'reduce' });

test('a move lands on its square immediately, with no hanging slide animation', async ({
  page,
}) => {
  const { lesson, def } = firstPieceMoveStep();

  await completeFirstRun(page, 'Kid');
  // Unlock whichever world/lesson this turns out to be, without playing through everything
  // before it (same seeded-progress shape `journey.spec.ts` uses).
  const profileId = await getSoleProfileId(page);
  await seedLessonsMastered(page, profileId, lessonsBefore(lesson));

  await page.reload();
  await expect(page.getByRole('heading', { name: "Who's playing today?" })).toBeVisible();
  await pickProfileFromPicker(page, 'Kid');

  await page.getByRole('button', { name: /Start|Continue/ }).click();
  await page.getByRole('button', { name: /Let me try/ }).click(); // Story -> Demo
  await page.getByRole('button', { name: /^Next/ }).click(); // Demo -> first guided try

  // Advance through whatever comes before `def` (any earlier guided tries / exercises).
  const guidedIndex = lesson.guided.indexOf(def);
  const guidedBefore = guidedIndex >= 0 ? lesson.guided.slice(0, guidedIndex) : lesson.guided;
  const exercisesBefore =
    guidedIndex >= 0 ? [] : lesson.exercises.slice(0, lesson.exercises.indexOf(def));
  for (const guided of guidedBefore) {
    await completeExercise(page, guided);
  }
  for (const exercise of exercisesBefore) {
    await completeExercise(page, exercise);
  }

  const move = firstMoveOf(def);
  await clickSquare(page, move.from);
  await clickSquare(page, move.to);

  // The un-reduced slide animation runs 180ms (board.css); this wait is well under that, so if
  // reduced motion were *not* applied the piece would still visibly be mid-slide here.
  await page.waitForTimeout(60);

  const destination = page.getByRole('button', { name: new RegExp(`^${move.to}, `) });
  const squareBox = await destination.boundingBox();
  const pieceBox = await destination.locator('span[aria-hidden="true"]').first().boundingBox();
  expect(squareBox).not.toBeNull();
  expect(pieceBox).not.toBeNull();
  if (!squareBox || !pieceBox) return;

  // The piece is centred on its square, not offset by a stale `translate()` from the slide.
  const squareCenterX = squareBox.x + squareBox.width / 2;
  const pieceCenterX = pieceBox.x + pieceBox.width / 2;
  expect(Math.abs(pieceCenterX - squareCenterX)).toBeLessThan(squareBox.width * 0.2);
});
