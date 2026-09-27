import { currentRank } from './journey.ts';
import type { RankDef, TracksCatalog } from './journey.ts';
import type { Lesson } from './lesson.ts';
import { lessonStatus } from './progress.ts';
import type { LessonProgress } from './progress.ts';
import type { SubjectCore } from './subject.ts';

/** One animal friend, earned once its character's lesson is done. `topicKey` resolves through
 * `t()` as-is (chess: `piece.r` etc. — `SubjectCore.characters`). */
export interface AnimalFriend {
  readonly character: string;
  readonly topicKey: string;
  readonly lessonId: string;
  readonly earned: boolean;
}

/** The subject's animal friends (chess: Rhino .. Caterpillar), each tied to the earliest lesson
 * that teaches its character, in `characters`' own key order. A character with no authored lesson
 * yet is left out (design-r4.md §2 leak #5). */
export function animalFriends(
  lessons: readonly Lesson[],
  progresses: readonly LessonProgress[],
  characters: SubjectCore['characters'],
): readonly AnimalFriend[] {
  const progressByLesson = new Map(progresses.map((progress) => [progress.lessonId, progress]));
  const friends: AnimalFriend[] = [];

  for (const [character, { topicKey }] of Object.entries(characters)) {
    const lesson = lessons
      .filter((candidate) => candidate.character === character)
      .sort((a, b) => a.order - b.order)[0];
    if (lesson === undefined) continue;
    const status = lessonStatus(lesson, progressByLesson.get(lesson.id));
    friends.push({
      character,
      topicKey,
      lessonId: lesson.id,
      earned: status === 'complete' || status === 'mastered',
    });
  }

  return friends;
}

/** A rank's place on My Den's ladder, relative to the profile's `currentRank`. */
export type RankState = 'done' | 'current' | 'locked';

/** One rank on My Den's ladder. */
export interface RankLadderEntry {
  readonly rank: RankDef;
  readonly state: RankState;
}

/** Every rank in `catalog.ranks`, tagged by its position relative to `currentRank`'s result: every
 * earlier rank is `done`, the current one `current`, every later one `locked`. */
export function rankLadder(
  catalog: TracksCatalog,
  lessons: readonly Lesson[],
  progresses: readonly LessonProgress[],
  unlocked?: ReadonlySet<string>,
): readonly RankLadderEntry[] {
  const current = currentRank(catalog, lessons, progresses, unlocked);
  const currentIndex = current ? catalog.ranks.findIndex((rank) => rank.id === current.id) : -1;

  return catalog.ranks.map((rank, index) => ({
    rank,
    state: index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'locked',
  }));
}
