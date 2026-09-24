import { expect, test } from '@playwright/test';
import type { CompiledContent, Lesson, TracksCatalog, World } from '@chess-kids/core';
import { nextLesson, worldLessons } from '@chess-kids/core';
import rawContent from '@chess-kids/content/content.json' with { type: 'json' };
import rawTracks from '@chess-kids/content/tracks.json' with { type: 'json' };
import {
  completeFirstRun,
  finishFirstMessage,
  getSoleProfileId,
  journeyNodeName,
  pickProfileFromPicker,
  seedLessonMastered,
} from './helpers.ts';

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

test.describe('Journey map', () => {
  test('locked lesson explains itself, then unlocks once the one before it is done', async ({
    page,
  }) => {
    const { first, second } = firstTwoLessons();

    await completeFirstRun(page, 'Kid');
    await page.getByRole('button', { name: /Journey/ }).click();

    // The first lesson is current (available), the one after it is locked. Node names are
    // computed from the content (its title when Owl-taught, else "<Character> the <piece>").
    await expect(
      page.getByRole('button', { name: journeyNodeName(first, 'current') }),
    ).toBeVisible();
    const lockedNode = page.getByRole('button', { name: journeyNodeName(second, 'locked') });
    await expect(lockedNode).toBeVisible();

    // Tapping the locked node explains what to finish first, spoken (subtitles are the spoken text).
    await lockedNode.click();
    await expect(page.getByText(finishFirstMessage(first))).toBeVisible();

    // Seed progress the same way the app itself would (real storage key/shape), marking the first
    // lesson mastered, then reload: the second lesson should now be reachable from the Journey.
    const profileId = await getSoleProfileId(page);
    await seedLessonMastered(page, profileId, first);

    await page.reload();
    await expect(page.getByRole('heading', { name: "Who's playing today?" })).toBeVisible();
    await pickProfileFromPicker(page, 'Kid');
    await page.getByRole('button', { name: /Journey/ }).click();

    const unlockedNode = page.getByRole('button', { name: journeyNodeName(second, 'current') });
    await expect(unlockedNode).toBeVisible();

    // Opens it from the Journey: lands on its story (a never-played lesson always starts there).
    await unlockedNode.click();
    await expect(page.getByRole('button', { name: /Let me try/ })).toBeVisible();
  });
});
