import { expect, test } from '@playwright/test';
import type { CompiledContent, Lesson, TracksCatalog, World } from '@chess-kids/core';
import { nextLesson, worldLessons } from '@chess-kids/core';
import rawContent from '@chess-kids/content/content.json' with { type: 'json' };
import rawTracks from '@chess-kids/content/tracks.json' with { type: 'json' };
import { completeFirstRun, contentText, pickProfileFromPicker } from './helpers.ts';

const content = rawContent as unknown as CompiledContent;
const catalog = rawTracks as unknown as TracksCatalog;

function findWorld(id: string): World {
  for (const track of catalog.tracks) {
    const found = track.worlds.find((world) => world.id === id);
    if (found) return found;
  }
  throw new Error(`world "${id}" not found in tracks.json`);
}

/**
 * The Journey's first lesson for a brand-new profile, and the lesson right after it in the same
 * world — computed from the bundled content, same as `lesson.spec.ts`, so this stays correct
 * whichever lesson (and world) that turns out to be.
 */
function firstTwoLessons(): { readonly first: Lesson; readonly second: Lesson } {
  const first = nextLesson(catalog, content.lessons, []);
  if (!first) throw new Error('bundled content/tracks: no first lesson found');
  const siblings = worldLessons(findWorld(first.world), content.lessons);
  const second = siblings[siblings.findIndex((lesson) => lesson.id === first.id) + 1];
  if (!second) throw new Error(`world "${first.world}" needs at least 2 lessons for this test`);
  return { first, second };
}

/** Fills in the interpolated `{{name}}` of a compiled text template (this spec's templates have one). */
function interpolate(template: string, name: string): string {
  return template.replace('{{name}}', name);
}

test.describe('Journey map', () => {
  test('locked lesson explains itself, then unlocks once the one before it is done', async ({
    page,
  }) => {
    const { first, second } = firstTwoLessons();
    const firstName = contentText(`characters:${first.character}.name`);
    const secondName = contentText(`characters:${second.character}.name`);

    await completeFirstRun(page, 'Kid');
    await page.getByRole('button', { name: /Journey/ }).click();

    // The first lesson is current (available), the one after it is locked.
    await expect(
      page.getByRole('button', { name: new RegExp(`^${firstName} the .*, current$`) }),
    ).toBeVisible();
    const lockedNode = page.getByRole('button', {
      name: new RegExp(`^${secondName} the .*, locked$`),
    });
    await expect(lockedNode).toBeVisible();

    // Tapping the locked node explains what to finish first, spoken (subtitles are the spoken text).
    await lockedNode.click();
    const finishMessage = interpolate(contentText('journey:ui.finish-first'), firstName);
    await expect(page.getByText(finishMessage)).toBeVisible();

    // Seed progress the same way the app itself would (real storage key/shape), marking the first
    // lesson complete, then reload: the second lesson should now be reachable from the Journey.
    const profileId = await page.evaluate(() => {
      const raw = localStorage.getItem('chess-kids:profiles');
      const profiles = raw ? (JSON.parse(raw) as Record<string, { id: string }>) : {};
      const [profile] = Object.values(profiles);
      if (!profile) throw new Error('no seeded profile found in localStorage');
      return profile.id;
    });
    await page.evaluate(
      ({ profileId: pid, lessonId, exerciseIds }) => {
        const key = 'chess-kids:lesson-progress';
        const raw = localStorage.getItem(key);
        const all = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
        const now = new Date().toISOString();
        all[`${pid}:${lessonId}`] = {
          id: `seed-${lessonId}`,
          profileId: pid,
          lessonId,
          bestStars: Object.fromEntries(exerciseIds.map((id) => [id, 3])),
          bossStars: 0,
          resumeStep: 0,
          createdAt: now,
          updatedAt: now,
        };
        localStorage.setItem(key, JSON.stringify(all));
      },
      {
        profileId,
        lessonId: first.id,
        exerciseIds: first.exercises.map((exercise) => exercise.id),
      },
    );

    await page.reload();
    await expect(page.getByRole('heading', { name: "Who's playing today?" })).toBeVisible();
    await pickProfileFromPicker(page, 'Kid');
    await page.getByRole('button', { name: /Journey/ }).click();

    const unlockedNode = page.getByRole('button', {
      name: new RegExp(`^${secondName} the .*, current$`),
    });
    await expect(unlockedNode).toBeVisible();

    // Opens it from the Journey: lands on its story (a never-played lesson always starts there).
    await unlockedNode.click();
    await expect(page.getByRole('button', { name: /Let me try/ })).toBeVisible();
  });
});
