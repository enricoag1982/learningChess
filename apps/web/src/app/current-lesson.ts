import type { Lesson } from '@chess-kids/core';

/** The lesson Home should offer next. M1 ships a single lesson; picks the lowest `order` once more exist. */
export function pickCurrentLesson(lessons: readonly Lesson[]): Lesson | undefined {
  return [...lessons].sort((a, b) => a.order - b.order)[0];
}
