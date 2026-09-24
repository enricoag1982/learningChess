import type { PieceType } from './chess/types.ts';
import { currentRank } from './journey.ts';
import type { RankDef, TracksCatalog } from './journey.ts';
import type { Lesson } from './lesson.ts';
import { lessonStatus } from './progress.ts';
import type { LessonProgress } from './progress.ts';

/** The fixed World-2 piece-lesson characters, in rewards.md §2's catalogue order. */
const ANIMAL_FRIEND_CHARACTERS: readonly {
  readonly character: string;
  readonly piece: PieceType;
}[] = [
  { character: 'rhino', piece: 'r' },
  { character: 'elephant', piece: 'b' },
  { character: 'lioness', piece: 'q' },
  { character: 'lion', piece: 'k' },
  { character: 'horse', piece: 'n' },
  { character: 'caterpillar', piece: 'p' },
];

/** One animal friend (rewards.md §2), earned once its piece lesson is complete. */
export interface AnimalFriend {
  readonly character: string;
  readonly piece: PieceType;
  readonly lessonId: string;
  readonly earned: boolean;
}

/**
 * The fixed World-2 animal friends (Rhino .. Caterpillar), each tied to the earliest lesson that
 * teaches its character — `caterpillar`'s `pawn` lesson, not the later `promotion` lesson, which
 * shares the same character. A character with no authored lesson yet (content in progress) is
 * left out rather than reported as never-earnable.
 */
export function animalFriends(
  lessons: readonly Lesson[],
  progresses: readonly LessonProgress[],
): readonly AnimalFriend[] {
  const progressByLesson = new Map(progresses.map((progress) => [progress.lessonId, progress]));
  const friends: AnimalFriend[] = [];

  for (const { character, piece } of ANIMAL_FRIEND_CHARACTERS) {
    const lesson = lessons
      .filter((candidate) => candidate.character === character)
      .sort((a, b) => a.order - b.order)[0];
    if (lesson === undefined) continue;
    const status = lessonStatus(lesson, progressByLesson.get(lesson.id));
    friends.push({
      character,
      piece,
      lessonId: lesson.id,
      earned: status === 'complete' || status === 'mastered',
    });
  }

  return friends;
}

/** A rank's place on My Den's ladder, relative to the profile's `currentRank`. */
export type RankState = 'done' | 'current' | 'locked';

/** One rank on My Den's ladder (rewards.md §2). */
export interface RankLadderEntry {
  readonly rank: RankDef;
  readonly state: RankState;
}

/**
 * Every rank in `catalog.ranks` (authored easiest to hardest), tagged by its position relative to
 * `currentRank`'s result: every earlier rank is `done`, the current one `current`, every later one
 * `locked`.
 */
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
