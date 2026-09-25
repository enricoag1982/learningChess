import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { CompiledContent, TracksCatalog } from '@chess-kids/core';
import { nextLesson } from '@chess-kids/core';
import rawContent from '@chess-kids/content/content.json' with { type: 'json' };
import rawTracks from '@chess-kids/content/tracks.json' with { type: 'json' };
import {
  completeFirstRun,
  dismissCelebrationIfShown,
  getProfileIdByNickname,
  playLesson,
  seedLessonMastered,
} from './helpers.ts';

const content = rawContent as unknown as CompiledContent;
const catalog = rawTracks as unknown as TracksCatalog;

/** The Journey's very first lesson for a brand-new profile (see `lesson.spec.ts`'s own copy of
 * this helper — kept local here so this file stands alone). */
function firstJourneyLesson() {
  const lesson = nextLesson(catalog, content.lessons, []);
  if (!lesson) throw new Error('bundled content/tracks: no first lesson found');
  return lesson;
}

/** A second, different lesson from the same content — device B's own "other progress", so the
 * merge test can tell "both devices' progress kept" apart from one side simply overwriting the
 * other. */
function secondLesson() {
  const first = firstJourneyLesson();
  const lesson = content.lessons.find(
    (entry) => entry.id !== first.id && entry.exercises.length > 0,
  );
  if (!lesson) throw new Error('bundled content needs a second scored lesson for this spec');
  return lesson;
}

/** Removes the Web Share API before the app loads, so "Send to other device" always falls back to
 * its download path — Playwright drives no real OS share sheet (spec decision: "Playwright has no
 * share sheet"). */
async function disableWebShare(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(window.navigator, 'share', { value: undefined, configurable: true });
    Object.defineProperty(window.navigator, 'canShare', { value: undefined, configurable: true });
  });
}

/** Seeds one earned badge directly (same real storage shape as `LocalStorageRewardsRepository`'s
 * append-only `earned-badges` list) — there is no play-through fast enough to earn one for real in
 * this spec, and the merge rule under test ("union by badge id, seen if either is seen") only cares
 * that the row exists. */
async function seedEarnedBadge(page: Page, profileId: string, badgeId: string): Promise<void> {
  await page.evaluate(
    ({ profileId, badgeId }) => {
      const key = 'chess-kids:earned-badges';
      const raw = localStorage.getItem(key);
      const all: unknown[] = raw ? (JSON.parse(raw) as unknown[]) : [];
      const now = new Date().toISOString();
      all.push({
        id: `seed-badge-${badgeId}`,
        profileId,
        badgeId,
        at: now,
        seen: true,
        createdAt: now,
        updatedAt: now,
      });
      localStorage.setItem(key, JSON.stringify(all));
    },
    { profileId, badgeId },
  );
}

/**
 * Seeds today's own `SessionLog` row for `deviceId` (same real storage key `LocalStorageRewardsRepository`
 * uses for *this device's own* row, `<profileId>:<date>` — every profile has at most one such row in
 * this spec, so it never collides with another device's own row once re-keyed onto the same profile
 * id on import). Distinct from `helpers.ts`'s own `seedMinutesToday`: that one never stamps
 * `deviceId`, which would make two "devices'" seeded rows here collide under the same fixed id once
 * merged onto one profile — this spec needs genuinely distinct per-device rows instead, matching
 * what `app/rewards.ts`'s real `recordSessionMinutes` stamps once a device has its own id (M7.2).
 */
async function seedTodayMinutesForDevice(
  page: Page,
  profileId: string,
  minutes: number,
  deviceId: string,
): Promise<void> {
  await page.evaluate(
    ({ profileId, minutes, deviceId }) => {
      const key = 'chess-kids:session-logs';
      const raw = localStorage.getItem(key);
      const all: Record<string, unknown> = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      const now = new Date();
      const date = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, '0'),
        String(now.getDate()).padStart(2, '0'),
      ].join('-');
      all[`${profileId}:${date}`] = {
        id: `seed-session-log-${deviceId}`,
        profileId,
        date,
        minutes,
        deviceId,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };
      localStorage.setItem(key, JSON.stringify(all));
    },
    { profileId, minutes, deviceId },
  );
}

/** Number of earned-badge rows for `profileId`, read straight from localStorage. */
async function earnedBadgeCount(page: Page, profileId: string): Promise<number> {
  return page.evaluate((profileId) => {
    const raw = localStorage.getItem('chess-kids:earned-badges');
    const all: readonly { readonly profileId: string }[] = raw
      ? (JSON.parse(raw) as readonly { readonly profileId: string }[])
      : [];
    return all.filter((badge) => badge.profileId === profileId).length;
  }, profileId);
}

/** Today's own played minutes for `profileId`, summed across every device row (same shape
 * `totalMinutesForDate` reads) — read straight from localStorage. */
async function minutesTodaySummed(page: Page, profileId: string): Promise<number> {
  return page.evaluate((profileId) => {
    type SessionLogRow = {
      readonly profileId: string;
      readonly date: string;
      readonly minutes: number;
    };
    const raw = localStorage.getItem('chess-kids:session-logs');
    const all: Record<string, SessionLogRow> = raw
      ? (JSON.parse(raw) as Record<string, SessionLogRow>)
      : {};
    const today = new Date();
    const date = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0'),
    ].join('-');
    return Object.values(all)
      .filter((log) => log.profileId === profileId && log.date === date)
      .reduce((sum, log) => sum + log.minutes, 0);
  }, profileId);
}

/** One lesson's saved `bestStars`, read straight from localStorage's real storage shape, or `{}`. */
async function readBestStars(
  page: Page,
  profileId: string,
  lessonId: string,
): Promise<Readonly<Record<string, number>>> {
  return page.evaluate(
    ({ profileId, lessonId }) => {
      type LessonProgressRow = { readonly bestStars: Record<string, number> };
      const raw = localStorage.getItem('chess-kids:lesson-progress');
      const all: Record<string, LessonProgressRow> = raw
        ? (JSON.parse(raw) as Record<string, LessonProgressRow>)
        : {};
      return all[`${profileId}:${lessonId}`]?.bestStars ?? {};
    },
    { profileId, lessonId },
  );
}

/**
 * Opens the parent area from the profile picker (a reload always lands there —
 * app-structure.md §3), with the standard test password (same as `parent-area.spec.ts`'s own
 * helper): "Grown-ups" lives on the picker screen itself, no profile tap needed first.
 */
async function openParentArea(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Grown-ups/ }).click();
  await page.getByLabel('Parent code', { exact: true }).fill('1234');
  await page.getByRole('button', { name: 'Open' }).click();
  await page.getByRole('heading', { name: 'Parent area' }).waitFor();
}

test.describe('Device sharing (M7.2): export merges into another device', () => {
  test('device A plays a lesson and sends its file; device B (own child + own progress) merges it in; re-importing the same file does not double anything', async ({
    browser,
  }) => {
    test.setTimeout(120_000); // two full installs + a real lesson play + two import flows

    const lessonA = firstJourneyLesson();
    const lessonB = secondLesson();

    // --- Device A: a fresh install, plays a lesson for real, seeds a badge + today's minutes. ---
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    await disableWebShare(pageA);
    await completeFirstRun(pageA, 'Mia');
    const miaA = await getProfileIdByNickname(pageA, 'Mia');

    // Story -> Demo -> first guided try (same tail `startLessonToFirstGuided` uses, without its
    // own `completeFirstRun` call — this device already has its own "Mia", not "Kid").
    await pageA.getByRole('button', { name: /Start/ }).click();
    await pageA.getByRole('button', { name: /Let me try/ }).click(); // Story -> Demo
    await pageA.getByRole('button', { name: /^Next/ }).click(); // Demo -> first guided try

    await playLesson(pageA, lessonA, content.minigames);
    await expect(pageA.getByText('Lesson complete!')).toBeVisible();
    await dismissCelebrationIfShown(pageA);

    await seedEarnedBadge(pageA, miaA, 'first-win');
    await seedTodayMinutesForDevice(pageA, miaA, 12, 'device-a');
    await pageA.reload();

    await openParentArea(pageA);
    await pageA.getByRole('button', { name: 'Backup' }).click();
    const [downloadA] = await Promise.all([
      pageA.waitForEvent('download'),
      pageA.getByRole('button', { name: 'Send to other device' }).click(),
    ]);
    expect(downloadA.suggestedFilename()).toMatch(/^chess-for-kids-all-\d{4}-\d{2}-\d{2}\.json$/);
    // Saved to a stable path before closing device A's context: a context's own downloads are
    // cleaned up with it, and this file must still exist once device B (a separate context) reads it.
    const exportedPath = join(mkdtempSync(join(tmpdir(), 'chess-kids-share-')), 'share.json');
    await downloadA.saveAs(exportedPath);
    await contextA.close();

    // --- Device B: a separate fresh install, its own "Mia" with different progress. ---
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    await completeFirstRun(pageB, 'Mia');
    const miaB = await getProfileIdByNickname(pageB, 'Mia');
    await seedLessonMastered(pageB, miaB, lessonB);
    await seedTodayMinutesForDevice(pageB, miaB, 8, 'device-b');
    await pageB.reload();

    await openParentArea(pageB);
    const miaCard = pageB.getByRole('button', { name: /^Mia/ });
    await expect(miaCard.getByText(/^[1-9]\d* stars$/)).toBeVisible();
    const starsBeforeImport = await miaCard.getByText(/ stars$/).textContent();

    await pageB.getByRole('button', { name: 'Backup' }).click();
    await pageB.getByLabel('Choose file').setInputFiles(exportedPath);

    // Same nickname, different device id -> preselected "Merge into Mia", not an automatic merge.
    const select = pageB.getByRole('combobox');
    await expect(select).toBeVisible();
    expect(await select.inputValue()).toBe(miaB);

    await pageB.getByRole('button', { name: 'Merge' }).click();
    await pageB.getByText('Import complete.').waitFor();

    // Both devices' progress present: device A's real play, and device B's own seeded lesson.
    const bestStarsA = await readBestStars(pageB, miaB, lessonA.id);
    expect(Object.keys(bestStarsA).length).toBeGreaterThan(0); // device A's real play merged in
    const bestStarsB = await readBestStars(pageB, miaB, lessonB.id);
    expect(Object.keys(bestStarsB).length).toBeGreaterThan(0); // device B's own progress kept

    await pageB.getByRole('button', { name: 'Back' }).click(); // backup -> overview
    await expect(miaCard.getByText(/ stars$/)).not.toHaveText(starsBeforeImport ?? '');
    const starsAfterFirstImport = await miaCard.getByText(/ stars$/).textContent();
    const badgesAfterFirstImport = await earnedBadgeCount(pageB, miaB);
    const minutesAfterFirstImport = await minutesTodaySummed(pageB, miaB);
    expect(badgesAfterFirstImport).toBeGreaterThan(0);
    expect(minutesAfterFirstImport).toBe(20); // device A's 12 + device B's own 8

    // Importing the exact same file again changes nothing further.
    await pageB.getByRole('button', { name: 'Backup' }).click();
    await pageB.getByLabel('Choose file').setInputFiles(exportedPath);
    await pageB.getByRole('button', { name: 'Merge' }).click();
    await pageB.getByText('Import complete.').waitFor();
    await pageB.getByRole('button', { name: 'Back' }).click();

    await expect(miaCard.getByText(/ stars$/)).toHaveText(starsAfterFirstImport ?? '');
    expect(await earnedBadgeCount(pageB, miaB)).toBe(badgesAfterFirstImport);
    expect(await minutesTodaySummed(pageB, miaB)).toBe(minutesAfterFirstImport);

    await contextB.close();
  });
});
