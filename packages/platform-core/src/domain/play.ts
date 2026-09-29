import type { Lesson } from './lesson.ts';
import { lessonStatus } from './progress.ts';
import type { LessonProgress, Stars } from './progress.ts';
import type { MiniGameBase } from './subject.ts';

/** One mini-game's Play-screen state; generic so callers keep their concrete mini-game type. */
export interface UnlockedMiniGame<M extends MiniGameBase = MiniGameBase> {
  readonly minigame: M;
  readonly unlocked: boolean;
  /** Best stars from the unlocking lesson's own boss slot — a possibly-stale lower bound; the Play
   * screen merges in the stored `MiniGameProgress`, taking whichever is higher. */
  readonly bestStars: Stars;
}

/** Every mini-game in content, with whether its `unlockAfter` lesson is complete (or mastered) and
 * that lesson's boss best stars so far. */
export function unlockedMiniGames<M extends MiniGameBase>(
  lessons: readonly Lesson[],
  minigames: readonly M[],
  progresses: readonly LessonProgress[],
): readonly UnlockedMiniGame<M>[] {
  const lessonById = new Map(lessons.map((lesson) => [lesson.id, lesson]));
  const progressByLesson = new Map(progresses.map((progress) => [progress.lessonId, progress]));

  return minigames.map((minigame) => {
    const lesson = lessonById.get(minigame.unlockAfter);
    const progress = lesson ? progressByLesson.get(lesson.id) : undefined;
    const status = lesson ? lessonStatus(lesson, progress) : 'new';
    return {
      minigame,
      unlocked: status === 'complete' || status === 'mastered',
      bestStars: progress?.bossStars ?? 0,
    };
  });
}
