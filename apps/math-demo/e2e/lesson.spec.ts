import { expect, test } from '@playwright/test';
import {
  dismissCelebrationIfShown,
  findLesson,
  pickProfileFromPicker,
  playLesson,
  startLessonToFirstGuided,
} from './kit.ts';

test.describe('First lesson', () => {
  test('play the whole lesson end to end, then the stars survive a reload', async ({ page }) => {
    const lesson = findLesson('add-within-5');

    await startLessonToFirstGuided(page);
    await playLesson(page, lesson);

    await expect(page.getByRole('heading', { name: 'Lesson complete!' })).toBeVisible();
    // A newly earned badge celebrates first, its own "Continue" sharing this screen's text.
    await dismissCelebrationIfShown(page);
    await page.getByRole('button', { name: /Continue/ }).click();

    await expect(page.getByText('Great session!')).toBeVisible();
    await page.getByRole('button', { name: 'Done' }).click();

    const starsPill = page.locator('[aria-label$=" stars"]');
    await expect(starsPill).toHaveAttribute('aria-label', /^(?!0 stars$).+/);

    await page.reload();
    await pickProfileFromPicker(page, 'Kid');
    await expect(starsPill).toHaveAttribute('aria-label', /^(?!0 stars$).+/);
  });
});
