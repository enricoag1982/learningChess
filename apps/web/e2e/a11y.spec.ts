import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import type {
  CompiledContent,
  ExerciseDef,
  Lesson,
  MiniGame,
  TracksCatalog,
} from '@chess-kids/core';
import { nextLesson, SQUARES, worldLessons } from '@chess-kids/core';
import rawContent from '@chess-kids/content/content.json' with { type: 'json' };
import rawTracks from '@chess-kids/content/tracks.json' with { type: 'json' };
import {
  answerExerciseWrongThenSolve,
  clickSquare,
  completeBoss,
  completeExercise,
  completeFirstRun,
  contentText,
  dismissCelebrationIfShown,
  findMiniGame,
  getSoleProfileId,
  isMoveCountedExercise,
  journeyNodeName,
  lessonsInJourneyOrder,
  pickProfileFromPicker,
  playOneKidVersusMove,
  playSolveLine,
  playVersusBoss,
  seedDailyLimit,
  seedMinutesToday,
  selectSquaresAnswer,
  shownExercise,
  solveExercise,
  waitForVersusTurnOrEnd,
  worldBossMiniGame,
  worldTabName,
} from './helpers.ts';

const content = rawContent as unknown as CompiledContent;
const catalog = rawTracks as unknown as TracksCatalog;

/** The first two lessons of a brand-new profile's first world (siblings, same world) — the second
 * one naturally locked, no seeding needed (M4.5's own onboarding/test-out a11y walk below). */
function firstTwoLessons(): { readonly first: Lesson; readonly second: Lesson } {
  const first = nextLesson(catalog, content.lessons, []);
  if (!first) throw new Error('bundled content/tracks: no first lesson found');
  const world = catalog.tracks.flatMap((track) => track.worlds).find((w) => w.id === first.world);
  if (!world) throw new Error(`world "${first.world}" not found in tracks.json`);
  const siblings = worldLessons(world, content.lessons);
  const second = siblings[siblings.findIndex((lesson) => lesson.id === first.id) + 1];
  if (!second) throw new Error(`world "${first.world}" needs at least 2 lessons for this test`);
  return { first, second };
}

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

/**
 * Tappable vs info (docs/screens.md §1, roadmap F3; widened v1.1.0 part B, playtest 2): every real
 * `<button>` on the screen carries the shared `.tap-raised` marker class, and no non-button element
 * does; every raised, enabled button's boundary (its border, or its background if the border is
 * transparent) has >= 3:1 contrast (WCAG 2.2 SC 1.4.11) against the nearest opaque ancestor
 * background it sits on; and a rank/stars pill (`RankPill`/`StarsPill`, "Info = no box") has no
 * background box or border. The board (`role="grid"`, one button per square) is its own established
 * game surface, not part of this contrast, so it is excluded, as is a disabled or `.tap-locked`
 * button (docs/screens.md §1 "Disabled: ... exempt"); a `role="dialog"`/`"alertdialog"` open at scan
 * time is included (its own buttons still need to be raised).
 */
async function expectOnlyButtonsRaised(page: Page, screen: string): Promise<void> {
  const result = await page.evaluate(() => {
    const board = document.querySelector('[role="grid"]');
    const unraisedButtons = Array.from(document.querySelectorAll('button'))
      .filter((button) => !board?.contains(button))
      .filter((button) => !button.classList.contains('tap-raised'))
      .map(
        (button) => button.getAttribute('aria-label') ?? (button.textContent.trim() || '(unnamed)'),
      );
    const raisedNonButtons = Array.from(document.querySelectorAll('.tap-raised'))
      .filter((el) => el.tagName !== 'BUTTON')
      .map((el) => `<${el.tagName.toLowerCase()}> ${el.outerHTML.slice(0, 100)}`);

    // WCAG relative luminance / contrast ratio (same formula as the lead's own contrast-calc
    // script, docs/screens.md §1.1) computed live from `getComputedStyle`, since only the browser
    // knows the actual rendered (post-cascade, post-CSS-variable) colour of every element.
    function parseColor(value: string): { r: number; g: number; b: number; a: number } | null {
      const m = value.match(/rgba?\(([^)]+)\)/);
      const inner = m?.[1];
      if (inner === undefined) return null;
      const parts = inner.split(',').map((s) => parseFloat(s.trim()));
      const [r, g, b, a = 1] = parts;
      if (r === undefined || g === undefined || b === undefined) return null;
      return { r, g, b, a };
    }
    function relLuminance(c: { r: number; g: number; b: number }): number {
      const f = (channel: number): number => {
        const cs = channel / 255;
        return cs <= 0.03928 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
    }
    function contrastRatio(
      c1: { r: number; g: number; b: number },
      c2: { r: number; g: number; b: number },
    ): number {
      const l1 = relLuminance(c1);
      const l2 = relLuminance(c2);
      const [lighter, darker] = l1 > l2 ? [l1, l2] : [l2, l1];
      return (lighter + 0.05) / (darker + 0.05);
    }
    // Walks up from an element's parent to the first ancestor with a fully opaque background —
    // the "surface around it" a boundary is judged against (docs/screens.md §1 "Measurable rule").
    function nearestOpaqueAncestorBg(el: Element): { r: number; g: number; b: number } {
      let node = el.parentElement;
      while (node) {
        const c = parseColor(getComputedStyle(node).backgroundColor);
        if (c && c.a >= 0.999) return c;
        node = node.parentElement;
      }
      return { r: 255, g: 255, b: 255 }; // none found: the default document canvas is white
    }

    const lowContrastButtons: string[] = [];
    for (const button of Array.from(document.querySelectorAll('button.tap-raised'))) {
      if (board?.contains(button)) continue;
      const el = button as HTMLButtonElement;
      if (el.disabled || el.classList.contains('tap-locked')) continue;
      const style = getComputedStyle(el);
      const borderColor = parseColor(style.borderTopColor);
      const hasBorder =
        borderColor !== null && borderColor.a > 0 && parseFloat(style.borderTopWidth) > 0;
      const boundary = hasBorder ? borderColor : parseColor(style.backgroundColor);
      if (!boundary) continue;
      const ratio = contrastRatio(boundary, nearestOpaqueAncestorBg(el));
      if (ratio < 3) {
        const name = el.getAttribute('aria-label') ?? (el.textContent.trim() || '(unnamed)');
        lowContrastButtons.push(`${name}: ${ratio.toFixed(2)}:1`);
      }
    }

    const pillViolations = Array.from(
      document.querySelectorAll('[data-testid="rank-pill"], [data-testid="stars-pill"]'),
    )
      .filter((el) => {
        const style = getComputedStyle(el);
        const bg = parseColor(style.backgroundColor);
        const hasVisibleBg = bg !== null && bg.a > 0;
        const hasBorder = style.borderTopStyle !== 'none' && parseFloat(style.borderTopWidth) > 0;
        return hasVisibleBg || hasBorder;
      })
      .map((el) => el.getAttribute('data-testid') ?? '(pill)');

    return { unraisedButtons, raisedNonButtons, lowContrastButtons, pillViolations };
  });
  expect(result.unraisedButtons, `${screen}: <button>s missing .tap-raised`).toEqual([]);
  expect(result.raisedNonButtons, `${screen}: non-<button> elements with .tap-raised`).toEqual([]);
  expect(
    result.lowContrastButtons,
    `${screen}: raised buttons under 3:1 boundary contrast`,
  ).toEqual([]);
  expect(result.pillViolations, `${screen}: rank/stars pill with a background or border`).toEqual(
    [],
  );
}

/** Kid touch targets must be >= 64px both ways (docs/screens.md §1). */
async function expectKidTouchTarget(page: Page, name: RegExp | string): Promise<void> {
  const box = await page.getByRole('button', { name }).boundingBox();
  expect(box, `no bounding box for button matching ${String(name)}`).not.toBeNull();
  expect(box?.width ?? 0, `${String(name)} width`).toBeGreaterThanOrEqual(64);
  expect(box?.height ?? 0, `${String(name)} height`).toBeGreaterThanOrEqual(64);
}

/** Parent-area touch targets must be >= 44px both ways (docs/screens.md §1). `role` defaults to
 * `'button'`; a toggle (M5.1 voice/sound/hints) is `role="switch"` instead. `scope` narrows the
 * lookup (M7.1: the daily-limit block's own "Off" chip is no longer unique on the settings screen
 * — "Play until"/"Not before" each have one too — so a caller passes that chip row's own `group`
 * locator instead of the whole `page`). */
async function expectParentTouchTarget(
  scope: Page | Locator,
  name: RegExp | string,
  role: 'button' | 'switch' = 'button',
): Promise<void> {
  const box = await scope.getByRole(role, { name }).boundingBox();
  expect(box, `no bounding box for ${role} matching ${String(name)}`).not.toBeNull();
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
  await expectParentTouchTarget(page, 'Save code');
  await expectNoSeriousViolations(page, 'First run: Password');

  // 2.5. Its "Read our privacy policy" link (M5.5): an in-screen dialog, not a new store screen.
  await page.getByRole('button', { name: 'Read our privacy policy' }).click();
  const privacyDialog = page.getByRole('dialog', { name: 'Privacy' });
  await privacyDialog.waitFor();
  await expectParentTouchTarget(page, 'Close');
  await expectNoSeriousViolations(page, 'First run: Privacy dialog');
  await privacyDialog.getByRole('button', { name: 'Close' }).click();
  await privacyDialog.waitFor({ state: 'hidden' });

  await page.getByLabel('Parent code', { exact: true }).fill('1234');
  await page.getByLabel('Repeat code').fill('1234');
  await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Save code' }).click(),
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

  // 5.5. Placement offer (M4.5, kid style): declined here (a full placement run is scanned in its
  // own dedicated test below, alongside the test-out sheet/runner/results).
  await page.getByText(contentText('placement.offer-question')).waitFor();
  await expectKidTouchTarget(page, contentText('placement.offer-yes'));
  await expectKidTouchTarget(page, contentText('placement.offer-no'));
  await expectNoSeriousViolations(page, 'Placement offer');
  await page.getByRole('button', { name: contentText('placement.offer-no') }).click();

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

  // 8. Parent area overview (parent style, M5.1: tappable child cards, no inline management
  // buttons any more — those moved to the child's own Settings screen, scanned next).
  await page.getByLabel('Parent code', { exact: true }).fill('1234');
  await page.getByRole('button', { name: 'Open' }).click();
  await expectParentTouchTarget(page, 'Add child');
  await expectParentTouchTarget(page, 'Backup');
  await expectNoSeriousViolations(page, 'Parent area: overview');
  await expectOnlyButtonsRaised(page, 'Parent area: overview');

  // 8.5. Overview -> Mia's card -> child report (parent style).
  await page.getByRole('button', { name: /^Mia/ }).click();
  await expectParentTouchTarget(page, 'Settings');
  await expectNoSeriousViolations(page, 'Parent area: child report');
  await expectOnlyButtonsRaised(page, 'Parent area: child report');

  // 8.6. Report -> Settings: rename/avatar, daily limit (M7.1: weekend toggle + hours), voice/
  // sound/hints, computer level, piece style, unlock panel, export, reset/delete — every control
  // on the busiest parent screen.
  await page.getByRole('button', { name: 'Settings' }).click();
  await expectParentTouchTarget(page, 'Rename');
  await expectParentTouchTarget(page, 'Change avatar');
  await expectParentTouchTarget(page.getByRole('group', { name: 'Every day' }), 'Off');
  await expectParentTouchTarget(page, 'Different limit at the weekend', 'switch');
  await expectParentTouchTarget(page.getByRole('group', { name: 'Play until' }), '20:00');
  await expectParentTouchTarget(page.getByRole('group', { name: 'Not before' }), '08:00');
  await expectParentTouchTarget(page, 'Voice', 'switch');
  await expectParentTouchTarget(page, 'Automatic');
  await expectParentTouchTarget(page, /^Animal badge$/);
  await expectParentTouchTarget(page, "Export this child's data");
  await expectParentTouchTarget(page, 'Reset progress');
  await expectParentTouchTarget(page, 'Delete');
  await expectNoSeriousViolations(page, 'Parent area: child settings');
  await expectOnlyButtonsRaised(page, 'Parent area: child settings');

  // 8.7. Settings -> Report -> Overview -> Backup.
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: 'Backup' }).click();
  await expectParentTouchTarget(page, 'Export all');
  await expectNoSeriousViolations(page, 'Parent area: backup');

  // 8.8. Backup -> Overview -> Privacy (M5.5): same policy text as the first-run dialog above.
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: 'Privacy' }).click();
  await expectParentTouchTarget(page, 'Back');
  await expectNoSeriousViolations(page, 'Parent area: privacy');
  await expectOnlyButtonsRaised(page, 'Parent area: privacy');

  // 8.9. Daily time limit (M5.2): "See you tomorrow" (kid style) once over the limit, then its own
  // "Parent: more time" password flow resuming the gated activity.
  await page.getByRole('button', { name: 'Back' }).click(); // Privacy -> Overview
  await page.getByRole('button', { name: contentText('parent.done') }).click(); // Overview -> picker
  await pickProfileFromPicker(page, 'Mia');
  const profileId = await getSoleProfileId(page);
  await seedDailyLimit(page, profileId, 15);
  await seedMinutesToday(page, profileId, 15);

  await page.getByRole('button', { name: /Start today/ }).click();
  await page.getByRole('heading', { name: 'See you tomorrow!' }).waitFor();
  await expectKidTouchTarget(page, 'Switch player');
  await expectKidTouchTarget(page, 'Parent: more time');
  await expectNoSeriousViolations(page, 'Time limit: See you tomorrow');
  await expectOnlyButtonsRaised(page, 'Time limit: See you tomorrow');

  await page.getByRole('button', { name: 'Parent: more time' }).click();
  await page.getByLabel('Parent code', { exact: true }).fill('1234');
  await page.getByRole('button', { name: 'Open' }).click();
  await page.getByRole('button', { name: /Let me try/ }).waitFor(); // resumed into the lesson
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
  await expectOnlyButtonsRaised(page, `Exercise (${def.type}, hint shown)`);

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
  await expectOnlyButtonsRaised(page, 'Home');

  // Play and My Den (app-structure.md §4): a fresh install, so every mini-game is locked and no
  // rank/friend is earned yet — still worth their own a11y + touch-target pass.
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expectKidTouchTarget(page, 'Back to Home');
  await expectKidTouchTarget(page, /Play a full game/);
  await expectKidTouchTarget(page, /^Hungry Rook,/);
  await expectNoSeriousViolations(page, 'Play');
  await expectOnlyButtonsRaised(page, 'Play');
  await page.getByRole('button', { name: 'Back to Home' }).click();

  await page.getByRole('button', { name: 'My Den', exact: true }).click();
  await expectKidTouchTarget(page, 'Back to Home');
  await expectNoSeriousViolations(page, 'My Den');
  await expectOnlyButtonsRaised(page, 'My Den');
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
      await expectKidTouchTarget(page, 'Skip'); // playtest 2
      await expectNoSeriousViolations(page, 'Story');
    }
    await page.getByRole('button', { name: /Let me try/ }).click();

    // Demo.
    if (!storyDemoScanned) {
      await expectKidTouchTarget(page, /^Next/);
      await expectKidTouchTarget(page, 'Skip'); // playtest 2
      await expectNoSeriousViolations(page, 'Demo');
      storyDemoScanned = true;
    }
    await page.getByRole('button', { name: /^Next/ }).click();

    // Guided tries (not individually a11y-scanned; deep-scanned scored exercises cover the UI).
    for (const guided of lesson.guided) {
      await expectKidTouchTarget(page, 'Skip'); // playtest 2: every guided try shows it
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

test('test-out sheet, runner and result screen have no serious/critical violations and kid-sized touch targets (M4.5)', async ({
  page,
}) => {
  test.setTimeout(60_000);
  const { second } = firstTwoLessons();

  await completeFirstRun(page, 'Kid');
  await page.getByRole('button', { name: /Journey/ }).click();
  await page.getByRole('button', { name: journeyNodeName(second, 'locked') }).click();

  // Locked-lesson message bar's "Show you know it?" button.
  await expectKidTouchTarget(page, contentText('journey:ui.show-you-know-it'));
  await expectNoSeriousViolations(page, 'Journey (locked lesson message)');
  await page.getByRole('button', { name: contentText('journey:ui.show-you-know-it') }).click();

  // The sheet itself (docs/screens.md §1: Owl row always stacked in a dialog).
  await page.getByRole('dialog', { name: contentText('journey:ui.show-you-know-it') }).waitFor();
  await expectKidTouchTarget(page, contentText('journey:ui.test-out-yes'));
  await expectKidTouchTarget(page, contentText('journey:ui.test-out-no'));
  await expectNoSeriousViolations(page, 'Test-out sheet');
  await page.getByRole('button', { name: contentText('journey:ui.test-out-yes') }).click();

  // The runner: no Hint control (domain-model.md §3.2 "no hints offered").
  await page.getByText(/^Task 1\//).waitFor();
  await expect(page.getByRole('button', { name: /Hint/ })).toHaveCount(0);
  await expectKidTouchTarget(page, /Say it again/);
  await expectNoSeriousViolations(page, 'Test-out runner');

  // Answers every task wrong-then-right (whichever the app picked at random from the lesson's own
  // exercise pool): a deterministic "Fail" result to also scan, without depending on which of its
  // (up to 5) tasks got picked.
  const failHeading = page.getByRole('heading', { name: contentText('assessment.fail-title') });
  for (let i = 0; i < second.exercises.length + 1; i += 1) {
    if (await failHeading.isVisible().catch(() => false)) break;
    const matched = await shownExercise(page, second.exercises);
    if (!matched)
      throw new Error('test-out runner: no candidate exercise matched the current task');
    await answerExerciseWrongThenSolve(page, matched);
    await page.getByRole('button', { name: /^Next/ }).click();
  }
  await failHeading.waitFor();

  await expectKidTouchTarget(page, contentText('assessment.continue'));
  await expectNoSeriousViolations(page, 'Test-out result (fail)');
  await page.getByRole('button', { name: contentText('assessment.continue') }).click();

  // Back on the Journey, no penalty: still locked (domain-model.md §3.2 "Fail").
  await page.getByRole('button', { name: journeyNodeName(second, 'locked') }).waitFor();
});
