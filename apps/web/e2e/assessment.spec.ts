import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { CompiledContent, ExerciseDef, TracksCatalog } from '@chess-kids/core';
import { PLACEMENT_TASKS_PER_WORLD, TEST_OUT_LESSON_TASKS, worldLessons } from '@chess-kids/core';
import rawContent from '@chess-kids/content/content.json' with { type: 'json' };
import rawTracks from '@chess-kids/content/tracks.json' with { type: 'json' };
import {
  answerExerciseWrongThenSolve,
  completeFirstRunToPlacementOffer,
  contentText,
  journeyNodeName,
  solveExercise,
  worldTabName,
} from './helpers.ts';

const content = rawContent as unknown as CompiledContent;
const catalog = rawTracks as unknown as TracksCatalog;

function findWorld(id: string) {
  for (const track of catalog.tracks) {
    const found = track.worlds.find((world) => world.id === id);
    if (found) return found;
  }
  throw new Error(`world "${id}" not found in tracks.json`);
}

/** Every scored exercise across a whole world's lessons (the pool `planTestOutWorld`/`planPlacement` sample from). */
function worldExercisePool(worldId: string): readonly ExerciseDef[] {
  return worldLessons(findWorld(worldId), content.lessons).flatMap((lesson) => lesson.exercises);
}

/**
 * Solves `count` assessment/placement tasks in a row, each of which the app picked at random from
 * `candidates` (that lesson's or world's own exercise pool) — matches by the task's own instruction
 * text, same pattern `solveWhicheverExercise` uses for warm-up/Practice. `wrong` answers every task
 * wrong on the first try (still solving it, M4.5: only hints are off — see
 * `answerExerciseWrongThenSolve`), guaranteeing a fail.
 */
async function runTasks(
  page: Page,
  candidates: readonly ExerciseDef[],
  count: number,
  wrong: boolean,
): Promise<void> {
  for (let i = 0; i < count; i += 1) {
    let matched: ExerciseDef | undefined;
    for (const candidate of candidates) {
      if (await page.getByText(contentText(candidate.textKey), { exact: true }).isVisible()) {
        matched = candidate;
        break;
      }
    }
    if (!matched) {
      throw new Error(`runTasks: no candidate instruction text matched task ${String(i + 1)}`);
    }
    if (wrong) {
      await answerExerciseWrongThenSolve(page, matched);
    } else {
      await solveExercise(page, matched);
    }
    await page.getByRole('button', { name: /^Next/ }).click();
  }
}

test.describe('Placement and test-out (M4.5)', () => {
  test('new player → placement → passes World 1, fails World 2 (no penalty) → test-out of a locked lesson passes', async ({
    page,
  }) => {
    test.setTimeout(90_000);

    // "board" (World 1) and "pieces" (World 2) neither has a world boss, so a fully passed/failed
    // placement run alone decides "mastered"/"available" — no boss win needed either way.
    const boardCandidates = worldExercisePool('board');
    const piecesLessons = worldLessons(findWorld('pieces'), content.lessons);
    const piecesCandidates = piecesLessons.flatMap((lesson) => lesson.exercises);

    await completeFirstRunToPlacementOffer(page, 'Kid');
    await page.getByRole('button', { name: contentText('placement.offer-yes') }).click();

    // World 1: answered correctly throughout → passes.
    await page.getByText(/^World 1 ·/).waitFor();
    await runTasks(page, boardCandidates, PLACEMENT_TASKS_PER_WORLD, false);

    // World 2: answered wrong throughout → fails; placement stops here (domain-model.md §3.2
    // "stops at the first failed world"), no penalty either way.
    await page.getByText(/^World 2 ·/).waitFor();
    await runTasks(page, piecesCandidates, PLACEMENT_TASKS_PER_WORLD, true);

    await page
      .getByRole('heading', { name: contentText('placement.summary-passed-title') })
      .waitFor();
    await page.getByRole('button', { name: contentText('placement.continue') }).click();
    await page.getByRole('heading', { level: 1, name: 'Chess for Kids' }).waitFor();

    // Journey: World 1 mastered (its lessons no longer show "current"/"locked" — done), World 2
    // available (its first lesson now reachable, though its own placement run failed).
    await page.getByRole('button', { name: /Journey/ }).click();
    await page.getByRole('button', { name: worldTabName(catalog, 'pieces') }).click();
    const [firstPiecesLesson, secondPiecesLesson] = piecesLessons;
    if (!firstPiecesLesson || !secondPiecesLesson) {
      throw new Error('"pieces" world needs at least 2 lessons for this test');
    }
    await expect(
      page.getByRole('button', { name: journeyNodeName(firstPiecesLesson, 'current') }),
    ).toBeVisible();
    // The world's second lesson is still locked (only its first lesson unlocked by World 1 being
    // mastered — World 2's own placement failed, so nothing beyond that was skipped ahead for it).
    const lockedNode = page.getByRole('button', {
      name: journeyNodeName(secondPiecesLesson, 'locked'),
    });
    await expect(lockedNode).toBeVisible();

    // Test-out that still-locked lesson: passes → it shows mastered (no longer locked).
    await lockedNode.click();
    await page.getByRole('button', { name: contentText('journey:ui.show-you-know-it') }).click();
    await page.getByRole('button', { name: contentText('journey:ui.test-out-yes') }).click();

    const taskCount = Math.min(TEST_OUT_LESSON_TASKS, secondPiecesLesson.exercises.length);
    await runTasks(page, secondPiecesLesson.exercises, taskCount, false);

    await page.getByRole('heading', { name: contentText('assessment.pass-title') }).waitFor();
    await page.getByRole('button', { name: contentText('assessment.continue') }).click();

    await expect(
      page.getByRole('button', { name: journeyNodeName(secondPiecesLesson, 'locked') }),
    ).toHaveCount(0);
  });
});
