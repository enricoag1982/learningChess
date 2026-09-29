/**
 * Fixture generator (docs/refactor-v4.md R0 "storage-compat fixtures") — NOT part of the regular
 * suite: it lives outside `apps/chess-kids/e2e/` (Playwright's `testDir`), so `pnpm test:e2e` never runs
 * it. It plays a realistic session through a released tag's own build (real UI actions, not
 * seeding, wherever that's cheap) and dumps the resulting `localStorage` plus real backup/share
 * exports, for `storage-compat.test.ts`/`storage-compat.spec.ts` (on `master`) to replay against.
 *
 * See `README.md` in this folder for how to run this against an old tag and add a fixture for a new
 * release — it needs copying into that tag's own e2e folder (`apps/web/e2e/` up to `v2.0.0`) and adapting to that version's own
 * labels/features (never the tag's app code).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from '@playwright/test';
import { PLACEMENT_TASKS_PER_WORLD, worldLessons } from '@learn/platform-core';
import {
  answerExerciseWrongThenSolve,
  completeExercise,
  completeFirstRun,
  content,
  contentText,
  dismissCelebrationIfShown,
  findWorld,
  getProfileIdByNickname,
  openParentArea,
  playLesson,
  shownExercise,
  solveExercise,
  solveWhicheverExercise,
} from '../../e2e/helpers.ts';

/** Set to the release tag being generated when this file is copied into its own worktree. */
const TAG = 'v2.0.0';
/** Relative to the app dir (`apps/web` in a pre-v4 tag; playwright's own cwd) — move the result into this package's own copy. */
const OUT_DIR = join('test-fixtures', 'storage', TAG);

/** Every scored exercise in the whole bundle — a safe superset of candidates for whichever concept
 * the review scheduler picks (`solveWhicheverExercise` matches by the one actually shown). */
const everyExercise = content.lessons.flatMap((lesson) => lesson.exercises);

/**
 * Clicks Home's "Start" and clears any due warm-up review first: a concept just practiced
 * for the first time can become due again immediately, so every "Start" after the very first one
 * in a sitting can show 1+ of these before the next lesson's own Story step.
 */
async function startTodaySession(page: import('@playwright/test').Page): Promise<void> {
  await page.getByRole('button', { name: /Start/ }).click();
  for (let guard = 0; guard < 10; guard += 1) {
    const warmupShown = await page
      .getByText(/^Warm-up \d+\/\d+$/)
      .isVisible()
      .catch(() => false);
    if (!warmupShown) return;
    await solveWhicheverExercise(page, everyExercise);
  }
  throw new Error('startTodaySession: warm-up never finished after 10 review tasks');
}

test('generate storage fixture', async ({ page }) => {
  test.setTimeout(300_000); // 4 real lessons/bosses + a placement run + several exports

  mkdirSync(OUT_DIR, { recursive: true });

  // Web Share disabled so "Send to other device" always falls back to a download — Playwright
  // drives no real OS share sheet (same as e2e/device-sharing.spec.ts).
  await page.addInitScript(() => {
    Object.defineProperty(window.navigator, 'share', { value: undefined, configurable: true });
    Object.defineProperty(window.navigator, 'canShare', { value: undefined, configurable: true });
  });

  // --- First run: parent code set at first run, child Mia. ---
  await completeFirstRun(page, 'Mia');
  await getProfileIdByNickname(page, 'Mia'); // fails loudly here if seeding ever breaks

  // --- Mia: World 1 ("board")'s lessons, played for real, in the app's own order — stars, at
  // least one badge (mastering a world earns its milestone badge), concept stats, and (two of
  // these lessons carry their own boss) at least one mini-game played. ---
  const boardLessons = worldLessons(findWorld('board'), content.lessons);
  for (const lesson of boardLessons) {
    await startTodaySession(page);
    await page.getByRole('button', { name: /Let me try/ }).click(); // Story -> Demo
    await page.getByRole('button', { name: /^Next/ }).click(); // Demo -> first guided try
    await playLesson(page, lesson, content.minigames);
    await page.getByText('Lesson complete!').waitFor();
    await dismissCelebrationIfShown(page);
    // Reload -> picker -> Mia, same as e2e/device-sharing.spec.ts: simpler and just as real as
    // clicking through the session-summary screen, and every reload always shows the picker.
    await page.reload();
    await page.getByRole('button', { name: /Mia/ }).click();
    await page.getByRole('heading', { level: 1, name: 'Chess for Kids' }).waitFor();
  }

  // --- Mia: one more lesson (World 2's first) left mid-way — a real resumeStep, not seeded. ---
  const nextLessons = worldLessons(findWorld('pieces'), content.lessons);
  const partialLesson = nextLessons[0];
  if (partialLesson === undefined) throw new Error('"pieces" world has no lessons');
  await startTodaySession(page);
  await page.getByRole('button', { name: /Let me try/ }).click();
  await page.getByRole('button', { name: /^Next/ }).click();
  for (const guided of partialLesson.guided) {
    await completeExercise(page, guided);
  }
  const [firstExercise] = partialLesson.exercises;
  if (firstExercise === undefined) {
    throw new Error(`lesson "${partialLesson.id}" has no exercises`);
  }
  await completeExercise(page, firstExercise);
  await page.getByRole('button', { name: 'Close lesson' }).click();
  await page.reload();
  await page.getByRole('button', { name: /Mia/ }).click();

  // --- Parent settings changed for Mia (real UI, chip rows): daily limit 30 on weekdays, 60 at
  // the weekend, play until 20:00 — and her own "Send to other device" (share) export.
  await page.getByRole('button', { name: 'Switch player' }).click();
  await openParentArea(page);
  await page.getByRole('button', { name: /^Mia/ }).click();
  await page.getByRole('button', { name: 'Settings' }).click();

  await page.getByRole('switch', { name: 'Different limit at the weekend' }).click();
  await page
    .getByRole('group', { name: 'Mon–Fri' })
    .getByRole('button', { name: '30 min' })
    .click();
  await page
    .getByRole('group', { name: 'Sat–Sun' })
    .getByRole('button', { name: '60 min' })
    .click();
  await page
    .getByRole('group', { name: 'Play until' })
    .getByRole('button', { name: '20:00' })
    .click();

  const [shareDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Send to other device' }).click(),
  ]);
  const sharePath = await shareDownload.path();
  if (!sharePath) throw new Error('share download had no local path');
  writeFileSync(join(OUT_DIR, 'share-mia.json'), readFileSync(sharePath, 'utf8'));

  await page.getByRole('button', { name: 'Back' }).click(); // settings -> report
  await page.getByRole('button', { name: 'Back' }).click(); // report -> overview
  await page.getByRole('button', { name: 'Done' }).click(); // overview -> picker

  // --- Child Leo: a fresh player from the picker itself (kid-accessible "New player" tile, not
  // the parent area's "Add child" — that flow, unlike this one, never offers placement),
  // placement test taken -> fails World 1 on purpose (fastest real path to one AssessmentResult).
  await page.getByRole('button', { name: 'New player' }).click();
  await page.getByPlaceholder('Your name').fill('Leo');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByText('Pick your animal!').waitFor();
  await page.getByRole('button', { name: "Let's play!" }).click();
  await page.getByText(contentText('placement.offer-question')).waitFor();
  await page.getByRole('button', { name: contentText('placement.offer-yes') }).click();

  const boardCandidates = boardLessons.flatMap((lesson) => lesson.exercises);
  await page.getByText(/^World 1 ·/).waitFor();
  for (let i = 0; i < PLACEMENT_TASKS_PER_WORLD; i += 1) {
    await page.getByText(new RegExp(`Task ${String(i + 1)}/\\d+$`)).waitFor();
    const matched = await shownExercise(page, boardCandidates);
    if (matched === undefined) {
      throw new Error(`placement task ${String(i + 1)}: no candidate instruction text matched`);
    }
    // "setup"/"mate-in-n" have no `answerExerciseWrongThenSolve` case (helpers.ts) — answered
    // correctly instead; World 1's pool has enough wrong-capable types that at least 2 of the 4
    // sampled tasks are normally still answered wrong, which already fails it (>= 2 wrong of 4
    // beats the 75% pass mark regardless of the rest) — see the failure check right below.
    if (matched.type === 'setup' || matched.type === 'mate-in-n') {
      await solveExercise(page, matched);
    } else {
      await answerExerciseWrongThenSolve(page, matched);
    }
    await page.getByRole('button', { name: /^Next/ }).click();
  }
  // If World 1 unexpectedly passed (an unlucky sample of mostly setup/mate-in-n tasks), the run
  // continues into World 2 instead of the summary — fail loudly rather than silently taking much
  // longer; re-running this generator (a fresh random sample) resolves it.
  await Promise.race([
    page.getByRole('heading', { name: contentText('placement.summary-none-title') }).waitFor(),
    page
      .getByText(/^World 2 ·/)
      .waitFor()
      .then(() => {
        throw new Error(
          'Leo unexpectedly PASSED World 1 placement (unlucky exercise-type sample) — re-run this generator',
        );
      }),
  ]);
  await page.getByRole('button', { name: contentText('placement.continue') }).click();
  await page.getByRole('heading', { level: 1, name: 'Chess for Kids' }).waitFor();

  // --- Full-device backup export (both children) — real UI, "Export all". A GameRecord (won/lost
  // vs the computer, or a full game abandoned) is NOT included: "Play a full game" only unlocks
  // after World 4 is mastered, far past this fixture's 3-4 lesson scope, so producing one cheaply
  // through real play was not possible here (see README.md's own note on this tag). ---
  await page.getByRole('button', { name: 'Switch player' }).click();
  await openParentArea(page);
  await page.getByRole('button', { name: 'Backup' }).click();
  const [exportAllDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export all' }).click(),
  ]);
  const exportAllPath = await exportAllDownload.path();
  if (!exportAllPath) throw new Error('export-all download had no local path');
  writeFileSync(join(OUT_DIR, 'backup-all.json'), readFileSync(exportAllPath, 'utf8'));

  // --- Every chess-kids:* key, raw string values (not re-parsed/re-stringified, so this is
  // exactly the bytes a real browser's localStorage holds). ---
  const dump = await page.evaluate(() => {
    const out: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key !== null && key.startsWith('chess-kids:')) {
        out[key] = localStorage.getItem(key) as string;
      }
    }
    return out;
  });
  const sorted = Object.fromEntries(Object.entries(dump).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(join(OUT_DIR, 'local-storage.json'), `${JSON.stringify(sorted, null, 2)}\n`);
});
