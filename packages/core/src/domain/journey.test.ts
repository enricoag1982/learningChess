import { describe, expect, it } from 'vitest';

import type { ExerciseDef } from './exercise/types.ts';
import {
  HABITATS,
  currentRank,
  isHabitat,
  lessonAvailability,
  nextLesson,
  worldLessons,
  worldStatus,
  type Track,
  type TracksCatalog,
  type World,
} from './journey.ts';
import type { Lesson } from './lesson.ts';
import type { LessonProgress } from './progress.ts';
import { newLessonProgress, recordBossStars, recordExerciseStars } from './progress.ts';

const EMPTY_POSITION = {
  pieces: {},
  markers: { stars: [], blocked: [] },
  toMove: 'w',
  castling: '-',
  enPassant: null,
} as const;

const NOW = new Date('2026-01-01T00:00:00.000Z');

function makeExercise(id: string): ExerciseDef {
  return {
    id,
    concept: `${id}-concept`,
    textKey: `lessons:${id}`,
    position: EMPTY_POSITION,
    type: 'collect-stars',
    stars3: 1,
    stars2: 2,
  };
}

/** One-exercise lesson (max 3 stars): 1 star = `complete`, 3 stars = `mastered` (2.4 threshold). */
function makeLesson(
  id: string,
  world: string,
  order: number,
  overrides: Partial<Lesson> = {},
): Lesson {
  return {
    id,
    world,
    order,
    concept: `${id}-concept`,
    character: 'rhino',
    titleKey: `lessons:${id}.title`,
    storyKey: `lessons:${id}.story`,
    demo: {
      position: EMPTY_POSITION,
      textKey: `lessons:${id}.demo`,
      highlight: { legalMovesFrom: 'd4' },
    },
    guided: [],
    exercises: [makeExercise(`${id}-01`)],
    ...overrides,
  };
}

function freshProgress(lessonId: string): LessonProgress {
  return newLessonProgress(`p-${lessonId}`, 'profile-1', lessonId, NOW);
}

/** Progress with every exercise at 1 star: `complete`, below the 80% mastery threshold. */
function completeProgress(lesson: Lesson): LessonProgress {
  return recordExerciseStars(freshProgress(lesson.id), `${lesson.id}-01`, 1, lesson, NOW);
}

/** Progress with every exercise at 3 stars: `mastered`. */
function masteredProgress(lesson: Lesson, bossStars: 0 | 1 | 2 | 3 = 0): LessonProgress {
  let progress = recordExerciseStars(freshProgress(lesson.id), `${lesson.id}-01`, 3, lesson, NOW);
  if (bossStars > 0) {
    progress = recordBossStars(progress, bossStars, NOW);
  }
  return progress;
}

// Basics: w1 → w2 → w3 (coming-soon: no authored lessons) → w4. Two branch tracks after Basics.
const W1: World = {
  id: 'w1',
  track: 'basics',
  order: 1,
  habitat: 'meadow',
  titleKey: 'journey:worlds.board',
};
const W2: World = {
  id: 'w2',
  track: 'basics',
  order: 2,
  habitat: 'savannah',
  titleKey: 'journey:worlds.pieces',
};
const W3: World = {
  id: 'w3',
  track: 'basics',
  order: 3,
  habitat: 'jungle',
  titleKey: 'journey:worlds.attack',
};
const W4: World = {
  id: 'w4',
  track: 'basics',
  order: 4,
  habitat: 'mountains',
  titleKey: 'journey:worlds.check',
};
const OW1: World = {
  id: 'ow1',
  track: 'openings',
  order: 1,
  habitat: 'forest',
  titleKey: 'journey:worlds.openings',
};
const TW1: World = {
  id: 'tw1',
  track: 'tactics',
  order: 1,
  habitat: 'ocean',
  titleKey: 'journey:worlds.tactics',
};

const BASICS: Track = {
  id: 'basics',
  kind: 'main',
  titleKey: 'journey:tracks.basics',
  worlds: [W1, W2, W3, W4],
};
const OPENINGS: Track = {
  id: 'openings',
  kind: 'branch',
  titleKey: 'journey:tracks.openings',
  worlds: [OW1],
};
const TACTICS: Track = {
  id: 'tactics',
  kind: 'branch',
  titleKey: 'journey:tracks.tactics',
  worlds: [TW1],
};

const CATALOG: TracksCatalog = {
  tracks: [BASICS, OPENINGS, TACTICS],
  ranks: [
    { id: 'pawn', after: 'start' },
    { id: 'knight', after: 'world:w1' },
    { id: 'rook', after: 'world:w2' },
    { id: 'queen', after: 'track:basics' },
    { id: 'king', after: 'all-tracks' },
  ],
};

const L1 = makeLesson('l1', 'w1', 1);
const L2 = makeLesson('l2', 'w1', 2, { boss: 'boss-l2' });
const L3 = makeLesson('l3', 'w2', 1);
const L4 = makeLesson('l4', 'w4', 1);
const OL1 = makeLesson('ol1', 'ow1', 1);
const OL2 = makeLesson('ol2', 'ow1', 2);
const TL1 = makeLesson('tl1', 'tw1', 1);

const ALL_LESSONS = [L1, L2, L3, L4, OL1, OL2, TL1];

describe('worldLessons', () => {
  it('sorts by order regardless of input order', () => {
    expect(worldLessons(W1, [L2, L1])).toEqual([L1, L2]);
  });

  it('is empty for a world with no authored lessons (coming-soon)', () => {
    expect(worldLessons(W3, ALL_LESSONS)).toEqual([]);
  });
});

describe('isHabitat / HABITATS', () => {
  it('accepts every fixed habitat and rejects an unknown one', () => {
    for (const habitat of HABITATS) {
      expect(isHabitat(habitat)).toBe(true);
    }
    expect(isHabitat('desert')).toBe(false);
  });
});

describe('worldStatus', () => {
  it('first world of the main track is available with no progress', () => {
    expect(worldStatus(CATALOG, W1, ALL_LESSONS, [])).toBe('available');
  });

  it('a world with no authored lessons is coming-soon, even when unlocked', () => {
    expect(worldStatus(CATALOG, W3, ALL_LESSONS, [])).toBe('coming-soon');
    expect(worldStatus(CATALOG, W3, ALL_LESSONS, [], new Set(['w3']))).toBe('coming-soon');
  });

  it('next world is locked until the previous one is mastered', () => {
    expect(worldStatus(CATALOG, W2, ALL_LESSONS, [])).toBe('locked');
    const partial = [completeProgress(L1), completeProgress(L2)];
    expect(worldStatus(CATALOG, W2, ALL_LESSONS, partial)).toBe('locked');
  });

  it('a lesson with an unwon boss keeps its world from mastering', () => {
    const progress = [masteredProgress(L1), masteredProgress(L2, 0)]; // L2 boss never played
    expect(worldStatus(CATALOG, W1, ALL_LESSONS, progress)).toBe('available');
    expect(worldStatus(CATALOG, W2, ALL_LESSONS, progress)).toBe('locked');
  });

  it('world is mastered once every lesson is mastered and every boss is won', () => {
    const progress = [masteredProgress(L1), masteredProgress(L2, 2)];
    expect(worldStatus(CATALOG, W1, ALL_LESSONS, progress)).toBe('mastered');
    expect(worldStatus(CATALOG, W2, ALL_LESSONS, progress)).toBe('available');
  });

  it('a coming-soon world never blocks: the next world looks past it', () => {
    const w2Mastered = [masteredProgress(L3)]; // w2's only lesson, no boss
    expect(worldStatus(CATALOG, W2, ALL_LESSONS, w2Mastered)).toBe('mastered');
    expect(worldStatus(CATALOG, W4, ALL_LESSONS, w2Mastered)).toBe('available');
  });

  it('unlocked makes a locked world available without mastering it', () => {
    expect(worldStatus(CATALOG, W2, ALL_LESSONS, [], new Set(['w2']))).toBe('available');
  });

  it('branch track is locked until Basics (including a coming-soon world) is mastered', () => {
    expect(worldStatus(CATALOG, OW1, ALL_LESSONS, [])).toBe('locked');
    const basicsExceptW3 = [
      masteredProgress(L1),
      masteredProgress(L2, 2),
      masteredProgress(L3),
      masteredProgress(L4),
    ];
    expect(worldStatus(CATALOG, OW1, ALL_LESSONS, basicsExceptW3)).toBe('locked'); // w3 unresolved
    expect(worldStatus(CATALOG, OW1, ALL_LESSONS, basicsExceptW3, new Set(['w3']))).toBe(
      'available',
    );
  });
});

describe('lessonAvailability', () => {
  it('only the first lesson of the first world is available with no progress', () => {
    const map = lessonAvailability(CATALOG, ALL_LESSONS, []);
    expect(map.get('l1')).toBe('available');
    expect(map.get('l2')).toBe('locked');
    expect(map.get('l3')).toBe('locked');
    expect(map.get('ol1')).toBe('locked');
  });

  it('next lesson becomes available once the previous one is complete', () => {
    const map = lessonAvailability(CATALOG, ALL_LESSONS, [completeProgress(L1)]);
    expect(map.get('l1')).toBe('complete');
    expect(map.get('l2')).toBe('available');
  });

  it('a mastered lesson also satisfies the gate for the next one', () => {
    const map = lessonAvailability(CATALOG, ALL_LESSONS, [masteredProgress(L1)]);
    expect(map.get('l1')).toBe('mastered');
    expect(map.get('l2')).toBe('available');
  });

  it('next world opens up once its predecessor is fully mastered (boss included)', () => {
    const progress = [masteredProgress(L1), masteredProgress(L2, 2)];
    const map = lessonAvailability(CATALOG, ALL_LESSONS, progress);
    expect(map.get('l3')).toBe('available');
  });

  it('an unlocked lesson id is available regardless of its world', () => {
    const map = lessonAvailability(CATALOG, ALL_LESSONS, [], new Set(['l3']));
    expect(map.get('l3')).toBe('available');
  });

  it('opens branch tracks once Basics, including an unlocked coming-soon world, is mastered', () => {
    const progress = [
      masteredProgress(L1),
      masteredProgress(L2, 2),
      masteredProgress(L3),
      masteredProgress(L4),
    ];
    const map = lessonAvailability(CATALOG, ALL_LESSONS, progress, new Set(['w3']));
    expect(map.get('ol1')).toBe('available');
    expect(map.get('tl1')).toBe('available');
  });
});

describe('nextLesson', () => {
  it('returns the first available lesson of the main track', () => {
    expect(nextLesson(CATALOG, ALL_LESSONS, [])?.id).toBe('l1');
  });

  it('advances along the main track as lessons complete', () => {
    expect(nextLesson(CATALOG, ALL_LESSONS, [completeProgress(L1)])?.id).toBe('l2');
  });

  it('picks the least advanced branch track once Basics is mastered', () => {
    const basicsProgress = [
      masteredProgress(L1),
      masteredProgress(L2, 2),
      masteredProgress(L3),
      masteredProgress(L4),
    ];
    const unlocked = new Set(['w3']);

    // Openings already has stars on ol1; tactics has none: tactics is "least advanced".
    const progress = [...basicsProgress, masteredProgress(OL1)];
    expect(nextLesson(CATALOG, ALL_LESSONS, progress, unlocked)?.id).toBe('tl1');
  });

  it('is null once every lesson in every track is done', () => {
    const progress = [
      masteredProgress(L1),
      masteredProgress(L2, 2),
      masteredProgress(L3),
      masteredProgress(L4),
      masteredProgress(OL1),
      masteredProgress(OL2),
      masteredProgress(TL1),
    ];
    expect(nextLesson(CATALOG, ALL_LESSONS, progress, new Set(['w3']))).toBeNull();
  });
});

describe('currentRank', () => {
  it('is the starting rank with no progress', () => {
    expect(currentRank(CATALOG, ALL_LESSONS, [])?.id).toBe('pawn');
  });

  it('advances per-world as worlds are mastered', () => {
    const progress = [masteredProgress(L1), masteredProgress(L2, 2)];
    expect(currentRank(CATALOG, ALL_LESSONS, progress)?.id).toBe('knight');
  });

  it('unlocked counts as mastered for rank gating too', () => {
    expect(currentRank(CATALOG, ALL_LESSONS, [], new Set(['w1']))?.id).toBe('knight');
  });

  it('reaches queen only once the whole Basics track, including w3, is mastered', () => {
    const withoutW3 = [
      masteredProgress(L1),
      masteredProgress(L2, 2),
      masteredProgress(L3),
      masteredProgress(L4),
    ];
    expect(currentRank(CATALOG, ALL_LESSONS, withoutW3)?.id).toBe('rook');
    expect(currentRank(CATALOG, ALL_LESSONS, withoutW3, new Set(['w3']))?.id).toBe('queen');
  });

  it('reaches king only once every track is mastered', () => {
    const everything = [
      masteredProgress(L1),
      masteredProgress(L2, 2),
      masteredProgress(L3),
      masteredProgress(L4),
      masteredProgress(OL1),
      masteredProgress(OL2),
      masteredProgress(TL1),
    ];
    const unlocked = new Set(['w3']);
    expect(currentRank(CATALOG, ALL_LESSONS, everything, unlocked)?.id).toBe('king');
  });
});
