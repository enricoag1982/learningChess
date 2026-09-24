import { screen, fireEvent } from '@testing-library/react';
import type { Profile } from '@chess-kids/core';
import {
  createProfile,
  getLessonProgress,
  selectProfile,
  setupParentPassword,
} from '@chess-kids/core';
import type { Services } from '../app/services.ts';

/**
 * Seeds a parent lock and one profile directly (bypassing the onboarding UI), as if first run
 * already happened and this profile was last selected — the state `<App>` finds at every
 * subsequent start (app-structure.md §3: picker first, that profile shown first).
 */
export async function seedReturningProfile(
  services: Services,
  nickname = 'Mia',
  avatar = 'fox',
): Promise<Profile> {
  await setupParentPassword(services.deps, '1234');
  const profile = await createProfile(services.deps, nickname, avatar);
  await selectProfile(services.deps, profile.id);
  return profile;
}

/** From an already-rendered profile picker, taps the tile named `nickname` and waits for Home. */
export async function pickProfileFromPicker(nickname: string): Promise<void> {
  fireEvent.click(await screen.findByRole('button', { name: new RegExp(nickname) }));
}

/**
 * Seeds every lesson in the "basics" track up to and including World 4 ("check") as mastered
 * (every exercise at 3 stars, boss at 3 stars where it has one), plus both World 3's and World 4's
 * own world bosses (`win-the-queen`, `first-game`) won — the ingredients `worldStatus`/
 * `worldBossStatus` need before World 4 counts as "mastered" (`docs/domain-model.md` §3, mirrors
 * the e2e helpers' pattern). Unlocks Mouse on the Play screen's vs Computer card (M3.5,
 * `app-structure.md` §7). Seeded via `ProgressRepository` directly (not `recordGame`), so it
 * writes no `GameRecord` — same as a real World 4 playthrough, the kid's first `first-game` win
 * still counts toward Rabbit's "beat Mouse 3x", just not from this shortcut.
 */
export async function seedWorldFourMastered(services: Services, profileId: string): Promise<void> {
  const catalog = services.deps.content.catalog?.();
  if (!catalog) throw new Error('bundled content: catalog() not wired up');
  const basics = catalog.tracks.find((track) => track.id === 'basics');
  if (!basics) throw new Error('bundled content: "basics" track not found');
  const checkWorld = basics.worlds.find((world) => world.id === 'check');
  if (!checkWorld) throw new Error('bundled content: "check" world not found');

  const worldIds = new Set(
    basics.worlds.filter((world) => world.order <= checkWorld.order).map((world) => world.id),
  );
  const lessons = services.deps.content.lessons().filter((lesson) => worldIds.has(lesson.world));
  for (const lesson of lessons) {
    const saved = await getLessonProgress(services.deps, profileId, lesson.id);
    const bestStars = Object.fromEntries(
      lesson.exercises.map((exercise) => [exercise.id, 3 as const]),
    );
    await services.deps.progress.saveLesson({
      ...saved,
      bestStars,
      bossStars: lesson.boss !== undefined ? 3 : 0,
    });
  }

  const now = new Date().toISOString();
  for (const miniGameId of ['win-the-queen', 'first-game']) {
    await services.deps.progress.saveMiniGame({
      id: `seed-${miniGameId}`,
      profileId,
      miniGameId,
      bestStars: 3,
      plays: 1,
      wins: 1,
      createdAt: now,
      updatedAt: now,
    });
  }
}
