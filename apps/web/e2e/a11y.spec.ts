import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import type { CompiledContent, ExerciseDef, MiniGame, TracksCatalog } from '@chess-kids/core';
import { SQUARES } from '@chess-kids/core';
import rawContent from '@chess-kids/content/content.json' with { type: 'json' };
import rawTracks from '@chess-kids/content/tracks.json' with { type: 'json' };
import {
  clickSquare,
  completeBoss,
  completeExercise,
  completeFirstRun,
  contentText,
  findMiniGame,
  isMoveCountedExercise,
  journeyNodeName,
  lessonsInJourneyOrder,
  playOneKidVersusMove,
  playSolveLine,
  playVersusBoss,
  selectSquaresAnswer,
  waitForVersusTurnOrEnd,
} from './helpers.ts';

const content = rawContent as unknown as CompiledContent;
const catalog = rawTracks as unknown as TracksCatalog;

/** Fails on `serious` / `critical` axe-core violations (non-functional.md §2: WCAG 2.2 AA). */
async function expectNoSeriousViolations(page: Page, screen: string): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter(
    (violation) => violation.impact === 'serious' || violation.impact === 'critical',
  );
  expect(serious, `${screen}: ${JSON.stringify(serious, null, 2)}`).toEqual([]);
}

/** Kid touch targets must be >= 64px both ways (docs/screens.md §1). */
async function expectKidTouchTarget(page: Page, name: RegExp | string): Promise<void> {
  const box = await page.getByRole('button', { name }).boundingBox();
  expect(box, `no bounding box for button matching ${String(name)}`).not.toBeNull();
  expect(box?.width ?? 0, `${String(name)} width`).toBeGreaterThanOrEqual(64);
  expect(box?.height ?? 0, `${String(name)} height`).toBeGreaterThanOrEqual(64);
}

/** Parent-area touch targets must be >= 44px both ways (docs/screens.md §1). */
async function expectParentTouchTarget(page: Page, name: RegExp | string): Promise<void> {
  const box = await page.getByRole('button', { name }).boundingBox();
  expect(box, `no bounding box for button matching ${String(name)}`).not.toBeNull();
  expect(box?.width ?? 0, `${String(name)} width`).toBeGreaterThanOrEqual(44);
  expect(box?.height ?? 0, `${String(name)} height`).toBeGreaterThanOrEqual(44);
}

test('onboarding and profile screens have no serious/critical violations and correctly sized touch targets', async ({
  page,
}) => {
  // 1. First run: Welcome (kid style).
  await page.goto('/');
  await expectKidTouchTarget(page, 'Start setup');
  await expectNoSeriousViolations(page, 'First run: Welcome');

  // 2. First run: parent password (parent style).
  await page.getByRole('button', { name: 'Start setup' }).click();
  await expectParentTouchTarget(page, 'Save password');
  await expectNoSeriousViolations(page, 'First run: Password');

  await page.getByLabel('Password', { exact: true }).fill('1234');
  await page.getByLabel('Repeat password').fill('1234');
  await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Save password' }).click(),
  ]);

  // 3. First run: Saved (parent style).
  await expectParentTouchTarget(page, 'Next');
  await expectNoSeriousViolations(page, 'First run: Saved');
  await page.getByRole('button', { name: 'Next' }).click();

  // 4. New player: nickname (kid style).
  await expectKidTouchTarget(page, 'Next');
  await expectNoSeriousViolations(page, 'New player: nickname');
  await page.getByPlaceholder('Your name').fill('Mia');
  await page.getByRole('button', { name: 'Next' }).click();

  // 5. New player: avatar (kid style).
  await expectKidTouchTarget(page, 'Fox');
  await expectKidTouchTarget(page, "Let's play!");
  await expectNoSeriousViolations(page, 'New player: avatar');
  await page.getByRole('button', { name: "Let's play!" }).click();

  // 6. Home's switch-player button, then the picker (kid style).
  await expectKidTouchTarget(page, 'Switch player');
  await page.getByRole('button', { name: 'Switch player' }).click();
  await expectKidTouchTarget(page, 'Mia');
  await expectKidTouchTarget(page, /Grown-ups/);
  await expectNoSeriousViolations(page, 'Picker');

  // 7. Password screen (parent style).
  await page.getByRole('button', { name: /Grown-ups/ }).click();
  await expectParentTouchTarget(page, 'Open');
  await expectNoSeriousViolations(page, 'Password screen');

  // 8. Parent area (parent style).
  await page.getByLabel('Password', { exact: true }).fill('1234');
  await page.getByRole('button', { name: 'Open' }).click();
  await expectParentTouchTarget(page, 'Add child');
  await expectParentTouchTarget(page, 'Rename');
  await expectNoSeriousViolations(page, 'Parent area');
});

/** Every exercise type actually authored in the bundled content (scored exercises only). */
function allExerciseTypes(): ReadonlySet<string> {
  return new Set(
    content.lessons.flatMap((lesson) => lesson.exercises.map((exercise) => exercise.type)),
  );
}

/**
 * Full a11y + touch-target scan of one exercise definition, tailored to its type's own controls
 * (Hint always; Undo only for a move-counted type; Check only for select-squares; Yes/No for
 * yes-no; choice tiles for choice), then solves and advances past it. For select-squares, also
 * exercises a wrong pick (orange note, never red — non-functional.md §2).
 */
async function deepScanExercise(page: Page, def: ExerciseDef): Promise<void> {
  await expectKidTouchTarget(page, /Hint/);
  if (isMoveCountedExercise(def)) {
    await expectKidTouchTarget(page, /Undo/);
  }
  await expectKidTouchTarget(page, /Say it again/);

  // With a hint note under the instruction the panel is at its tallest: targets must not shrink.
  await page.getByRole('button', { name: /Hint/ }).click();
  await expectKidTouchTarget(page, /Say it again/);
  await expectKidTouchTarget(page, /Hint/);
  await expectNoSeriousViolations(page, `Exercise (${def.type}, hint shown)`);

  if (def.type === 'yes-no') {
    await expectKidTouchTarget(page, contentText('exercise.yes'));
    await expectKidTouchTarget(page, contentText('exercise.no'));
  } else if (def.type === 'choice') {
    for (const option of def.options) {
      if (option.textKey !== undefined) {
        await expectKidTouchTarget(page, contentText(option.textKey));
        continue;
      }
      if (!option.piece) {
        throw new Error(`choice exercise "${def.id}" option has neither text nor piece`);
      }
      const color = contentText(`board.color.${option.piece.color}`);
      const piece = contentText(`board.piece.${option.piece.type}`);
      await expectKidTouchTarget(page, `${color} ${piece}`);
    }
  } else if (def.type === 'select-squares') {
    const answer = new Set(selectSquaresAnswer(def));
    const wrongSquare = SQUARES.find((square) => !answer.has(square));
    if (wrongSquare === undefined) {
      throw new Error(`select-squares exercise "${def.id}": every square is a correct answer`);
    }
    await clickSquare(page, wrongSquare);
    await expectKidTouchTarget(page, /Check/);
    await page.getByRole('button', { name: /Check/ }).click();
    await expect(page.getByText('Not quite! Look at the orange squares.')).toBeVisible();
    await expectNoSeriousViolations(page, 'Exercise (select-squares, wrong pick)');
    await clickSquare(page, wrongSquare); // deselect the wrong pick
  }

  await completeExercise(page, def);
}

test('lesson flow has no serious/critical accessibility violations and kid-sized touch targets', async ({
  page,
}) => {
  // Walking far enough into the curriculum to reach a versus boss (M2.6, possibly two: Pawn Wars
  // Jr. and Pawn Wars, the latter reached for its `choice`/`best-move` exercises) pushes this well
  // past the 30s default even with the bot's "thinking" pause shortened below (typically ~1min).
  test.setTimeout(150_000);

  // Walk the Journey's lessons in order, deep-scanning the first exercise of each type that
  // exists in content, the first series boss (mid-round) and first static boss, and the Complete
  // step — whichever lessons those turn out to be, so this stays correct as content grows.
  const orderedLessons = lessonsInJourneyOrder(catalog, content.lessons);
  const wantedTypes = allExerciseTypes();
  const scannedTypes = new Set<string>();
  let seriesBossScanned = false;
  let staticBossScanned = false;
  let versusBossScanned = false;
  let completeScanned = false;
  let storyDemoScanned = false;
  let journeyScanned = false;
  let currentWorldId: string | undefined;

  await completeFirstRun(page);
  // Shortens the bot's "thinking" pause for every versus boss reached below (Pawn Wars Jr. and,
  // to deep-scan `choice`/`best-move`, Pawn Wars too) — set now, well before either is reached.
  await page.evaluate(() => {
    localStorage.setItem('chess-kids:test-seed', '1');
  });
  await expectKidTouchTarget(page, /Start/);
  await expectKidTouchTarget(page, /Journey/);
  await expectNoSeriousViolations(page, 'Home');

  for (const lesson of orderedLessons) {
    const allScanned =
      scannedTypes.size === wantedTypes.size &&
      seriesBossScanned &&
      staticBossScanned &&
      versusBossScanned &&
      completeScanned;
    if (allScanned) break;

    // Enter the lesson: via the Journey for the first lesson of a new world (the case where a
    // static boss, say, is only reachable later), else via Home's Start/Continue button.
    const enteringNewWorld = lesson.world !== currentWorldId;
    currentWorldId = lesson.world;

    if (enteringNewWorld) {
      await page.getByRole('button', { name: /Journey/ }).click();
      await expectKidTouchTarget(page, journeyNodeName(lesson, 'current'));
      if (!journeyScanned) {
        await expectKidTouchTarget(page, /Back to Home/);
        await expectNoSeriousViolations(page, 'Journey');
        journeyScanned = true;
      }
      await page.getByRole('button', { name: journeyNodeName(lesson, 'current') }).click();
    } else {
      await page.getByRole('button', { name: /Start|Continue/ }).click();
    }

    // Story.
    if (!storyDemoScanned) {
      await expectKidTouchTarget(page, 'Close lesson');
      await expectKidTouchTarget(page, /Listen again/);
      await expectKidTouchTarget(page, /Let me try/);
      await expectNoSeriousViolations(page, 'Story');
    }
    await page.getByRole('button', { name: /Let me try/ }).click();

    // Demo.
    if (!storyDemoScanned) {
      await expectKidTouchTarget(page, /^Next/);
      await expectNoSeriousViolations(page, 'Demo');
      storyDemoScanned = true;
    }
    await page.getByRole('button', { name: /^Next/ }).click();

    // Guided tries (not individually a11y-scanned; deep-scanned scored exercises cover the UI).
    for (const guided of lesson.guided) {
      await expectKidTouchTarget(page, /Hint/);
      if (isMoveCountedExercise(guided)) {
        await expectKidTouchTarget(page, /Undo/);
      }
      await completeExercise(page, guided);
    }

    // Scored exercises: deep-scan the first occurrence of each not-yet-seen type.
    for (const exercise of lesson.exercises) {
      if (scannedTypes.has(exercise.type)) {
        await completeExercise(page, exercise);
      } else {
        await deepScanExercise(page, exercise);
        scannedTypes.add(exercise.type);
      }
    }

    // Boss: deep-scan the first series boss mid-round, and the first static boss before solving.
    if (lesson.boss) {
      const boss: MiniGame = findMiniGame(lesson.boss);
      if (boss.mode === 'series' && !seriesBossScanned) {
        const [firstRound, ...restRounds] = boss.rounds;
        if (!firstRound) throw new Error(`mini-game "${boss.id}" has no rounds`);
        await completeExercise(page, firstRound);
        await expectNoSeriousViolations(page, 'Boss (series, mid-round)');
        for (const round of restRounds) {
          await completeExercise(page, round);
        }
        await page.getByRole('button', { name: /^Next/ }).click();
        seriesBossScanned = true;
      } else if (boss.mode === 'static' && !staticBossScanned) {
        await expectNoSeriousViolations(page, 'Boss (static)');
        const goal = boss.goal === 'collect-stars' ? 'collect-stars' : 'capture';
        await playSolveLine(page, boss.position, goal);
        await page.getByRole('button', { name: /^Next/ }).click();
        staticBossScanned = true;
      } else if (boss.mode === 'versus' && !versusBossScanned) {
        await expectKidTouchTarget(page, /Take back/);
        await expectNoSeriousViolations(page, 'Boss (versus, start)');
        await playOneKidVersusMove(page, boss);
        await waitForVersusTurnOrEnd(page);
        await expectNoSeriousViolations(page, 'Boss (versus, mid-game)');
        await playVersusBoss(page, boss);
        await page.getByRole('button', { name: /^Next/ }).click();
        versusBossScanned = true;
      } else {
        await completeBoss(page, boss);
      }
    }

    // Complete.
    await expect(page.getByText('Lesson complete!')).toBeVisible();
    if (!completeScanned) {
      await expectKidTouchTarget(page, /Play again/);
      await expectKidTouchTarget(page, /Continue/);
      await expectNoSeriousViolations(page, 'Complete');
      completeScanned = true;
    }
    await page.getByRole('button', { name: /Continue/ }).click();

    if (enteringNewWorld) {
      // A lesson opened from the Journey returns to the Journey, not Home, on Continue.
      await page.getByRole('button', { name: /Back to Home/ }).click();
    }
  }

  expect([...scannedTypes].sort(), 'every exercise type in content got a deep scan').toEqual(
    [...wantedTypes].sort(),
  );
  expect(seriesBossScanned, 'a series boss got a mid-round scan').toBe(true);
  expect(staticBossScanned, 'a static boss got a scan').toBe(true);
  expect(versusBossScanned, 'a versus boss got a mid-game scan').toBe(true);
  expect(completeScanned, 'the Complete step got a scan').toBe(true);
});
