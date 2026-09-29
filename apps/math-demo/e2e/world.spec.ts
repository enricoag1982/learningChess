import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { MathLesson } from '@learn/subject-math';
import {
  contentText,
  dismissCelebrationIfShown,
  findLesson,
  findMiniGame,
  journeyNodeName,
  playLesson,
  playSeries,
  startLessonToFirstGuided,
  worldBossNodeName,
} from './kit.ts';

/** From the Journey: opens `lesson`'s current node, plays it, and returns to the Journey. */
async function playLessonFromJourney(page: Page, lesson: MathLesson): Promise<void> {
  await page.getByRole('button', { name: journeyNodeName(lesson, 'current') }).click();
  await page.getByRole('button', { name: /Let me try/ }).click(); // Story -> Demo
  await page.getByRole('button', { name: /^Next/ }).click(); // Demo -> first guided try
  await playLesson(page, lesson);
  await expect(page.getByRole('heading', { name: 'Lesson complete!' })).toBeVisible();
  await dismissCelebrationIfShown(page);
  await page.getByRole('button', { name: /Continue/ }).click();
}

test.describe('World 1: Adding', () => {
  test('lessons 2 and 3 from the Journey, then the Number Parade boss', async ({ page }) => {
    const first = findLesson('add-within-5');
    const second = findLesson('add-within-10');
    const third = findLesson('take-away');
    const boss = findMiniGame('number-parade');

    // Lesson 1 through Today's session, which is what unlocks the Journey's second node.
    await startLessonToFirstGuided(page);
    await playLesson(page, first);
    await dismissCelebrationIfShown(page);
    await page.getByRole('button', { name: /Continue/ }).click();
    await page.getByRole('button', { name: 'Done' }).click();

    await page.getByRole('button', { name: /Journey/ }).click();
    await expect(
      page.getByRole('button', { name: worldBossNodeName(boss, 'locked') }),
    ).toBeVisible();
    await playLessonFromJourney(page, second);
    await playLessonFromJourney(page, third);

    await page.getByRole('button', { name: worldBossNodeName(boss, 'available') }).click();
    await playSeries(page, boss);
    await page.getByRole('button', { name: contentText('play.back-to-journey') }).click();
    await expect(page.getByRole('button', { name: worldBossNodeName(boss, 'won') })).toBeVisible();
  });
});
