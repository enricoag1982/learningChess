import { expect, test } from '@playwright/test';
import {
  completeFirstRun,
  finishFirstMessage,
  firstTwoLessons,
  getSoleProfileId,
  journeyNodeName,
  pickProfileFromPicker,
  seedLessonMastered,
} from './helpers.ts';

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
