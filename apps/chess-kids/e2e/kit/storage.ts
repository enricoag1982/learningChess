import type { Page } from '@playwright/test';
import type { AppSettings, ProfileSettings, TracksCatalog } from '@learn/platform-core';
import type { Lesson } from '@learn/subject-chess';
import { localDayString } from '@learn/platform-core';
import { DEFAULT_PROFILE_SETTINGS } from '@learn/subject-chess';
import { LocalStorageGameRecordRepository } from '@learn/platform-web/adapters/storage/local-game-record-repository.ts';
import { LocalStorageProfileRepository } from '@learn/platform-web/adapters/storage/local-profile-repository.ts';
import { LocalStorageProgressRepository } from '@learn/platform-web/adapters/storage/local-progress-repository.ts';
import { LocalStorageRewardsRepository } from '@learn/platform-web/adapters/storage/local-rewards-repository.ts';
import { LocalStorageSettingsRepository } from '@learn/platform-web/adapters/storage/local-settings-repository.ts';
import {
  openLocalStore,
  SCHEMA_VERSION,
} from '@learn/platform-web/adapters/storage/local-store.ts';
import { MIGRATIONS } from '@learn/platform-web/adapters/storage/migrations.ts';
import { createMemoryStorage } from '@learn/platform-web/testing/memory-storage.ts';

/** The real repositories a spec can drive directly, over the page's own storage (`withAppStorage`). */
export interface AppStorageRepos {
  readonly profiles: LocalStorageProfileRepository;
  readonly progress: LocalStorageProgressRepository;
  readonly gameRecords: LocalStorageGameRecordRepository;
  readonly rewards: LocalStorageRewardsRepository;
  readonly settings: LocalStorageSettingsRepository;
}

/** Every `chess-kids:*` key `page`'s `localStorage` currently holds. */
async function dumpStorage(page: Page): Promise<Readonly<Record<string, string>>> {
  return page.evaluate(() => {
    const out: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key !== null) out[key] = localStorage.getItem(key) ?? '';
    }
    return out;
  });
}

/** Replaces `page`'s `localStorage` with exactly `entries` (same real storage shape a reload reads). */
async function loadStorage(page: Page, entries: Readonly<Record<string, string>>): Promise<void> {
  await page.evaluate((entries) => {
    localStorage.clear();
    for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value);
  }, entries);
}

/**
 * Runs `fn` against the page's own storage through the real repository classes (same ones the app
 * itself uses), instead of the app's own webpage/React tree: reads `page`'s `localStorage` into a
 * fresh in-memory `Storage`, opens it the same way `createServices` does (`openLocalStore` +
 * `MIGRATIONS`), lets `fn` read/write through `AppStorageRepos`, then writes the result back to
 * `page`. Every seed/read helper below is one call to this.
 */
export async function withAppStorage<T>(
  page: Page,
  fn: (repos: AppStorageRepos) => T | Promise<T>,
): Promise<T> {
  const before = await dumpStorage(page);
  const storage = createMemoryStorage();
  for (const [key, value] of Object.entries(before)) storage.setItem(key, value);

  const store = openLocalStore(storage, { version: SCHEMA_VERSION, migrations: MIGRATIONS });
  const repos: AppStorageRepos = {
    profiles: new LocalStorageProfileRepository(store),
    progress: new LocalStorageProgressRepository(store),
    gameRecords: new LocalStorageGameRecordRepository(store),
    rewards: new LocalStorageRewardsRepository(store),
    settings: new LocalStorageSettingsRepository(store),
  };
  const result = await fn(repos);

  const after: Record<string, string> = {};
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (key !== null) after[key] = storage.getItem(key) ?? '';
  }
  await loadStorage(page, after);

  return result;
}

/**
 * The single seeded profile's id — for specs that seed progress directly instead of playing
 * through it.
 */
export async function getSoleProfileId(page: Page): Promise<string> {
  return withAppStorage(page, async (repos) => {
    const [profile] = await repos.profiles.list();
    if (!profile) throw new Error('no seeded profile found in localStorage');
    return profile.id;
  });
}

/** One (of possibly several) seeded profile's id, found by its `nickname`. */
export async function getProfileIdByNickname(page: Page, nickname: string): Promise<string> {
  return withAppStorage(page, async (repos) => {
    const profiles = await repos.profiles.list();
    const profile = profiles.find((candidate) => candidate.nickname === nickname);
    if (!profile) throw new Error(`no seeded profile named "${nickname}" found in localStorage`);
    return profile.id;
  });
}

/**
 * Seeds one lesson's progress directly, marking it mastered: every exercise at 3 stars, and — for
 * a lesson with a boss — the boss "won" at 3 stars. Used to unlock a later world/lesson from the
 * Journey without playing through everything before it.
 */
export async function seedLessonMastered(
  page: Page,
  profileId: string,
  lesson: Lesson,
): Promise<void> {
  await withAppStorage(page, async (repos) => {
    const now = new Date().toISOString();
    await repos.progress.saveLesson({
      id: `seed-${lesson.id}`,
      profileId,
      lessonId: lesson.id,
      bestStars: Object.fromEntries(lesson.exercises.map((exercise) => [exercise.id, 3 as const])),
      bossStars: lesson.boss !== undefined ? 3 : 0,
      resumeStep: 0,
      createdAt: now,
      updatedAt: now,
    });
  });
}

/**
 * Seeds a world boss's own `MiniGameProgress` record (won, 3 stars) — the separate "played
 * standalone" record (`docs/domain-model.md` §2/§3) a world boss needs, on top of its
 * `LessonProgress.bossStars`, before `worldStatus`/`trackStatus` will call that world "mastered".
 */
export async function seedMiniGameWon(
  page: Page,
  profileId: string,
  miniGameId: string,
): Promise<void> {
  await withAppStorage(page, async (repos) => {
    const now = new Date().toISOString();
    await repos.progress.saveMiniGame({
      id: `seed-${miniGameId}`,
      profileId,
      miniGameId,
      bestStars: 3,
      plays: 1,
      wins: 1,
      createdAt: now,
      updatedAt: now,
    });
  });
}

/**
 * Seeds `count` full-game wins vs `opponentLevel` — used to unlock a higher computer level without
 * playing every prerequisite game through the UI (`docs/computer-opponent.md` §3: 3 full-game
 * wins vs the level right below unlocks the next one).
 */
export async function seedGameRecordWins(
  page: Page,
  profileId: string,
  opponentLevel: number,
  count: number,
): Promise<void> {
  await withAppStorage(page, async (repos) => {
    const now = new Date();
    for (let i = 0; i < count; i += 1) {
      now.setSeconds(now.getSeconds() + 1);
      await repos.gameRecords.add({
        id: `seed-win-${String(opponentLevel)}-${String(i)}`,
        profileId,
        game: 'full',
        opponent: `computer:${String(opponentLevel)}`,
        result: 'win',
        reason: 'checkmate',
        moves: ['e4', 'e5'],
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      });
    }
  });
}

/**
 * Sets a profile's daily time limit — every other setting defaults exactly as
 * `DEFAULT_PROFILE_SETTINGS` does.
 */
export async function seedDailyLimit(
  page: Page,
  profileId: string,
  dailyLimitMinutes: number,
): Promise<void> {
  await withAppStorage(page, async (repos) => {
    const settings = await repos.settings.get();
    await saveProfileSettings(repos, settings, profileId, {
      ...DEFAULT_PROFILE_SETTINGS,
      dailyLimitMinutes,
    });
  });
}

/**
 * Patches `playUntil` onto `profileId`'s stored settings, merged over whatever is already
 * stored (the defaults if none yet) so a spec can seed just this one allowed-hours edge
 * without clobbering an earlier `seedDailyLimit` call.
 */
export async function seedPlayUntil(
  page: Page,
  profileId: string,
  playUntil: string,
): Promise<void> {
  await withAppStorage(page, async (repos) => {
    const settings = await repos.settings.get();
    const current = settings.profileSettings[profileId] ?? DEFAULT_PROFILE_SETTINGS;
    await saveProfileSettings(repos, settings, profileId, { ...current, playUntil });
  });
}

/** Merges `next` into `settings.profileSettings[profileId]` and saves, keeping every other profile
 * and top-level field untouched — the one piece `seedDailyLimit`/`seedPlayUntil` share. */
async function saveProfileSettings(
  repos: AppStorageRepos,
  settings: AppSettings,
  profileId: string,
  next: ProfileSettings,
): Promise<void> {
  await repos.settings.save({
    ...settings,
    profileSettings: { ...settings.profileSettings, [profileId]: next },
  });
}

/**
 * Seeds today's own `SessionLog` row straight at `minutes` played — "no real waiting" for a
 * daily-limit spec: the activity gate reads this exactly like real logged minutes.
 */
export async function seedMinutesToday(
  page: Page,
  profileId: string,
  minutes: number,
): Promise<void> {
  await withAppStorage(page, async (repos) => {
    const now = new Date();
    await repos.rewards.saveSessionLog({
      id: 'seed-session-log',
      profileId,
      date: localDayString(now),
      minutes,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });
  });
}

/**
 * Seeds one lesson's progress with explicit `bestStars` and `resumeStep`, for a spec that needs to
 * land mid-lesson — e.g. right at a scored exercise that offers an easier variant — instead of at a
 * freshly mastered or brand-new one.
 */
export async function seedLessonProgress(
  page: Page,
  profileId: string,
  lesson: Lesson,
  bestStars: Readonly<Record<string, 1 | 2 | 3>>,
  resumeStep: number,
): Promise<void> {
  await withAppStorage(page, async (repos) => {
    const now = new Date().toISOString();
    await repos.progress.saveLesson({
      id: `seed-${lesson.id}`,
      profileId,
      lessonId: lesson.id,
      bestStars,
      bossStars: 0,
      resumeStep,
      createdAt: now,
      updatedAt: now,
    });
  });
}

/** Reads one lesson's saved `bestStars`, or `{}` if the lesson has no saved progress yet. */
export async function readLessonBestStars(
  page: Page,
  profileId: string,
  lessonId: string,
): Promise<Readonly<Record<string, number>>> {
  return withAppStorage(page, async (repos) => {
    const progress = await repos.progress.getLesson(profileId, lessonId);
    return progress?.bestStars ?? {};
  });
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
 * bundled here for specs that only need "World 4 mastered" as a starting point (vs Friend:
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
 * Seeds one concept's review state directly, due now by default — the Leitner scheduler's
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
  await withAppStorage(page, async (repos) => {
    const now = new Date().toISOString();
    await repos.progress.saveConceptStats({
      id: `seed-${conceptId}`,
      profileId,
      conceptId,
      recent: overrides.recent ?? [],
      box: overrides.box ?? 1,
      dueAt: overrides.dueAt ?? now,
      createdAt: now,
      updatedAt: now,
    });
  });
}
