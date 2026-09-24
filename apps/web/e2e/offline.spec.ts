import { expect, test } from '@playwright/test';
import { completeExercise, findLesson } from './helpers.ts';

test('plays a guided try and an exercise fully offline, with progress saved', async ({
  page,
  context,
}) => {
  const lesson = findLesson('rook');
  const [firstExercise] = lesson.exercises;
  if (lesson.guided.length === 0 || !firstExercise) {
    throw new Error('rook lesson fixture needs at least one guided try and one exercise');
  }

  await page.goto('/');
  await expect(page.getByText('Ready to play offline.')).toBeVisible({ timeout: 15_000 });

  await context.setOffline(true);
  await page.reload();

  await page.getByRole('button', { name: /Start/ }).click();
  await page.getByRole('button', { name: /Let me try/ }).click(); // Story -> Demo
  await page.getByRole('button', { name: /^Next/ }).click(); // Demo -> first guided try

  // All guided tries first (the lesson flow requires each in order), then one scored exercise.
  for (const guided of lesson.guided) {
    await completeExercise(page, guided);
  }
  await completeExercise(page, firstExercise);

  // Progress is saved to localStorage (no network involved), and survives a reload — still
  // offline (non-functional.md §1: the whole app, including progress, works with no network).
  const starsPill = page.locator('[aria-label$=" stars"]');
  await expect(starsPill).toHaveAttribute('aria-label', /^(?!0 stars$).+/);

  await page.reload();
  await expect(starsPill).toHaveAttribute('aria-label', /^(?!0 stars$).+/);
});
