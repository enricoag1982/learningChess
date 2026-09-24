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
  dismissCelebrationIfShown,
  findMiniGame,
  isMoveCountedExercise,
  journeyNodeName,
  lessonsInJourneyOrder,
  pickProfileFromPicker,
  playOneKidVersusMove,
  playSolveLine,
  playVersusBoss,
  selectSquaresAnswer,
  solveExercise,
  waitForVersusTurnOrEnd,
  worldBossMiniGame,
  worldTabName,
} from './helpers.ts';

const content = rawContent as unknown as CompiledContent;
const catalog = rawTracks as unknown as TracksCatalog;

/**
 * Clears any concept stats this walk's own deep-scanning has produced (M3.4: an exercise scanned
 * through its wrong-answer states reaches `EASIER_AFTER_ERRORS` and puts its concept in review,
 * due immediately) so the next Home "Start/Continue" goes straight to its lesson/mini-game — this
 * walk exists to scan lesson/exercise/boss/Practice/summary screens, not the warm-up run itself
 * (covered on its own by `today-session.spec.ts`), and a warm-up's exact task is picked at random
 * from the whole curriculum, too unpredictable to solve on sight reliably here.
 */
async function clearConceptStats(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.removeItem('chess-kids:concept-stats');
  });
}

/**
 * A lesson finished via Home's Start/Continue may also be followed by one trailing mini-game
 * (M3.4 session order: warm-up → lesson → mini-game → summary), whichever the session picked at
 * its start. Plays it through like `completeBoss`, but its own final "Continue" (not "Next" —
 * `BossPlaySession.primaryLabel`, `miniGameOrigin: 'today'`) leads to the session summary.
 */
async function passThroughTrailingMiniGame(page: Page): Promise<void> {
  const summary = page.getByText('Great session!');
  if (await summary.isVisible().catch(() => false)) return;

  const title = await page.getByRole('heading', { level: 2 }).textContent();
  const game = content.minigames.find((candidate) => contentText(candidate.titleKey) === title);
  if (!game) {
    throw new Error(`passThroughTrailingMiniGame: no mini-game titled "${title ?? ''}"`);
  }
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
  await page.getByRole('button', { name: 'Continue' }).click();
  await summary.waitFor();
}

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
    await expect(page.getByText(contentText('exercise.select-both'))).toBeVisible();
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
  // Walks the whole curriculum: grows with every world (2.3–2.5 min at World 4 under load).
  test.setTimeout(300_000);

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
  let summaryScanned = false;
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

  // Play and My Den (app-structure.md §4): a fresh install, so every mini-game is locked and no
  // rank/friend is earned yet — still worth their own a11y + touch-target pass.
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expectKidTouchTarget(page, 'Back to Home');
  await expectKidTouchTarget(page, /Play a full game/);
  await expectKidTouchTarget(page, /^Hungry Rook,/);
  await expectNoSeriousViolations(page, 'Play');
  await page.getByRole('button', { name: 'Back to Home' }).click();

  await page.getByRole('button', { name: 'My Den', exact: true }).click();
  await expectKidTouchTarget(page, 'Back to Home');
  await expectNoSeriousViolations(page, 'My Den');
  await page.getByRole('button', { name: 'Back to Home' }).click();

  // Practice (M3.4): nothing complete yet, so the "All done for today!" / no-topics state.
  await page.getByRole('button', { name: 'Practice', exact: true }).click();
  await expectKidTouchTarget(page, 'Back to Home');
  await expectKidTouchTarget(page, /Daily warm-up/);
  await expectNoSeriousViolations(page, 'Practice');
  await page.getByRole('button', { name: 'Back to Home' }).click();

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
    const previousWorldId = currentWorldId;
    currentWorldId = lesson.world;

    // Crossing into a new world requires the previous one to be fully "mastered"
    // (docs/domain-model.md §3: every lesson mastered, incl. `bossStars >= 2` on any lesson with
    // its own boss, plus the world's own `World.boss` — e.g. World 3's win-the-queen — won too).
    // Every exercise and lesson boss above was already played for real, for its own a11y/touch-
    // target scan; a lesson boss played against the bot can end in a loss or draw depending on the
    // opponent's random draws though, same as a real kid's might, which would leave that one lesson
    // short of "mastered" and so the whole world short of "mastered" even though nothing is wrong —
    // this walk needs the world unlocked regardless to keep scanning, so `bossStars` (only) is
    // force-corrected to 3 here for every lesson of the world just finished, never touching the
    // real `bestStars` a kid earned answering each exercise (already scanned above). A full reload
    // is the one reliable way to make the store pick the patch up (`refreshProgress` only fires on
    // specific store actions, not a bare localStorage write), so the profile is re-picked after.
    if (enteringNewWorld && previousWorldId !== undefined) {
      const previousWorldLessons = content.lessons.filter(
        (entry) => entry.world === previousWorldId,
      );
      await page.evaluate(
        ({ lessonIds }: { lessonIds: readonly string[] }) => {
          const raw = localStorage.getItem('chess-kids:profiles');
          const profiles = raw ? (JSON.parse(raw) as Record<string, { id: string }>) : {};
          const [profile] = Object.values(profiles);
          if (!profile) return;
          const key = 'chess-kids:lesson-progress';
          const allRaw = localStorage.getItem(key);
          const all = allRaw ? (JSON.parse(allRaw) as Record<string, { bossStars?: number }>) : {};
          for (const lessonId of lessonIds) {
            const record = all[`${profile.id}:${lessonId}`];
            if (record) record.bossStars = 3;
          }
          localStorage.setItem(key, JSON.stringify(all));
        },
        { lessonIds: previousWorldLessons.map((entry) => entry.id) },
      );
      await page.reload();
      await pickProfileFromPicker(page, 'Kid');

      const previousWorldBoss = worldBossMiniGame(catalog, previousWorldId);
      if (previousWorldBoss !== undefined) {
        // The world's own boss (distinct from any lesson's own boss slot): win it for real, same
        // route a kid uses from the Journey map. This leaves the page on the Journey screen.
        await page.getByRole('button', { name: /Journey/ }).click();
        await page.getByRole('button', { name: worldTabName(catalog, previousWorldId) }).click();
        await page
          .getByRole('button', {
            name: new RegExp(`^World boss: ${contentText(previousWorldBoss.titleKey)},`),
          })
          .click();
        if (previousWorldBoss.mode !== 'versus') {
          throw new Error(
            `world boss "${previousWorldBoss.id}" is expected to be a versus mini-game`,
          );
        }
        await playVersusBoss(page, previousWorldBoss);
        await page.getByRole('button', { name: contentText('play.back-to-journey') }).click();

        if (previousWorldBoss.id === 'first-game') {
          // M3.5: Play's own "Full game" entry (vs Computer card) — reachable only once World 4
          // is mastered, which winning `first-game` above just did. Scans the level-picked start,
          // a mid-game position, and the "Stop this game?" leave confirm, then returns to Journey
          // (this block's exit invariant, same as the plain mini-game-won path above).
          await page.getByRole('button', { name: 'Back to Home' }).click();
          await page.getByRole('button', { name: 'Play', exact: true }).click();
          await expectKidTouchTarget(page, /Play a full game/);
          await page.getByRole('button', { name: 'Play a full game' }).click();
          await expectKidTouchTarget(page, 'Close');
          await expectNoSeriousViolations(page, 'Full game (start)');

          await playOneKidVersusMove(page, previousWorldBoss);
          await waitForVersusTurnOrEnd(page);
          await expectNoSeriousViolations(page, 'Full game (mid-game)');

          await page.getByRole('button', { name: 'Close' }).click();
          await page.getByRole('alertdialog', { name: 'Stop this game?' }).waitFor();
          await expectKidTouchTarget(page, 'Stop game');
          await expectKidTouchTarget(page, 'Keep playing');
          await expectNoSeriousViolations(page, 'Full game (leave confirm)');
          await page.getByRole('button', { name: 'Stop game' }).click();

          await page.getByRole('heading', { name: 'Play' }).waitFor();
          await page.getByRole('button', { name: 'Back to Home' }).click();

          // M4.3: vs Friend — Pawn Wars and Win the Queen unlocked earlier already, so this is the
          // full choice of games. Only one profile exists in this walk, so the second player is
          // Guest (no second `GameRecord`, decision log). Pass-and-play (not face-to-face) keeps
          // every control to a single on-screen instance for the touch-target checks below.
          await page.getByRole('button', { name: 'Play', exact: true }).click();
          await expectKidTouchTarget(page, 'vs Friend');
          await page.getByRole('button', { name: 'vs Friend' }).click();
          await page.getByRole('heading', { name: 'vs Friend' }).waitFor();
          await expectKidTouchTarget(page, 'Guest');
          await expectKidTouchTarget(page, 'Full Game');
          await expectNoSeriousViolations(page, 'vs Friend (setup sheet)');

          await page.getByRole('button', { name: 'Guest' }).click();
          await page.getByRole('button', { name: 'Full Game' }).click();
          await page.getByRole('button', { name: 'Pass and play' }).click();
          await page.getByRole('button', { name: 'Start' }).click();
          await page.getByRole('button', { name: /^e2,/ }).waitFor();
          await expectKidTouchTarget(page, 'Take back');
          await expectKidTouchTarget(page, 'Stop');
          await expectNoSeriousViolations(page, 'vs Friend (game, start)');

          await clickSquare(page, 'e2');
          await clickSquare(page, 'e4');
          await page.getByRole('button', { name: /^e4, white pawn/ }).waitFor();
          await expectNoSeriousViolations(page, 'vs Friend (game, after a move)');

          await page.getByRole('button', { name: 'Take back' }).click();
          await page.getByRole('alertdialog', { name: 'Allow take back?' }).waitFor();
          await expectKidTouchTarget(page, 'Yes');
          await expectKidTouchTarget(page, 'No');
          await expectNoSeriousViolations(page, 'vs Friend (take-back ask)');
          await page.getByRole('button', { name: 'Yes' }).click();
          await page.getByRole('button', { name: /^e2, white pawn/ }).waitFor();

          await page.getByRole('button', { name: 'Stop' }).click();
          await page.getByRole('alertdialog', { name: 'Stop this game?' }).waitFor();
          await expectKidTouchTarget(page, 'Stop game');
          await expectKidTouchTarget(page, 'Keep playing');
          await expectNoSeriousViolations(page, 'vs Friend (stop confirm)');
          await page.getByRole('button', { name: 'Stop game' }).click();

          await page.getByRole('heading', { name: 'Play' }).waitFor();
          await page.getByRole('button', { name: 'Back to Home' }).click();
          await page.getByRole('button', { name: /Journey/ }).click();
        }
      }
    }

    if (enteringNewWorld) {
      // Already on the Journey screen when a world boss was just won above; otherwise get there
      // from Home. Either way, the target world's own tab must be selected explicitly: the
      // Journey's default map only follows `nextStep`, which does not always match this loop's own
      // (purely content-order) walk.
      if (
        previousWorldId === undefined ||
        worldBossMiniGame(catalog, previousWorldId) === undefined
      ) {
        await page.getByRole('button', { name: /Journey/ }).click();
      }
      await page.getByRole('button', { name: worldTabName(catalog, lesson.world) }).click();
      await expectKidTouchTarget(page, journeyNodeName(lesson, 'current'));
      if (!journeyScanned) {
        await expectKidTouchTarget(page, /Back to Home/);
        await expectNoSeriousViolations(page, 'Journey');
        journeyScanned = true;
      }
      await page.getByRole('button', { name: journeyNodeName(lesson, 'current') }).click();
    } else {
      await clearConceptStats(page);
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
    // M4.4: a newly earned badge celebrates first, its own "Continue" sharing this screen's own
    // button text — dismissed here (scanned on its own in `rewards.spec.ts`) so the checks below,
    // and the plain Continue click past them, see this screen alone, unambiguously.
    await dismissCelebrationIfShown(page);
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
    } else {
      // A lesson opened via Home's Start/Continue is its own Today session (M3.4): Continue may
      // first lead through a trailing mini-game, then lands on the session summary — not Home
      // directly.
      await passThroughTrailingMiniGame(page);
      await expect(page.getByText('Great session!')).toBeVisible();
      if (!summaryScanned) {
        await expectKidTouchTarget(page, 'Done');
        await expectNoSeriousViolations(page, 'Session summary');
        summaryScanned = true;
      }
      await page.getByRole('button', { name: 'Done' }).click();
    }
  }

  expect([...scannedTypes].sort(), 'every exercise type in content got a deep scan').toEqual(
    [...wantedTypes].sort(),
  );
  expect(seriesBossScanned, 'a series boss got a mid-round scan').toBe(true);
  expect(staticBossScanned, 'a static boss got a scan').toBe(true);
  expect(versusBossScanned, 'a versus boss got a mid-game scan').toBe(true);
  expect(completeScanned, 'the Complete step got a scan').toBe(true);
  expect(summaryScanned, 'the session summary got a scan').toBe(true);
});
