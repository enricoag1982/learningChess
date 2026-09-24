import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Lesson, MiniGame, TracksCatalog } from '@chess-kids/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadBadges } from './badges-load.ts';
import { ContentError, type Locales } from './load.ts';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'chess-kids-badges-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function write(content: string): string {
  const filePath = join(dir, 'badges.yaml');
  writeFileSync(filePath, content, 'utf8');
  return filePath;
}

const CATALOG: TracksCatalog = {
  tracks: [
    {
      id: 'basics',
      kind: 'main',
      titleKey: 'journey:tracks.basics',
      worlds: [
        {
          id: 'board',
          track: 'basics',
          order: 1,
          habitat: 'meadow',
          titleKey: 'journey:worlds.board',
        },
      ],
    },
  ],
  ranks: [{ id: 'pawn', after: 'start' }],
};

const LESSON: Lesson = {
  id: 'rook',
  world: 'board',
  order: 1,
  concept: 'rook-move',
  character: 'rhino',
  titleKey: 'lessons:rook.title',
  storyKey: 'lessons:rook.story',
  demo: {
    position: {
      pieces: {},
      markers: { stars: [], blocked: [] },
      toMove: 'w',
      castling: '-',
      enPassant: null,
    },
    textKey: 'lessons:rook.demo',
    highlight: { squares: [] },
  },
  guided: [],
  exercises: [],
};

const MINIGAME: MiniGame = {
  mode: 'series',
  id: 'pawn-wars',
  concept: 'pawn-move',
  unlockAfter: 'rook',
  rounds: [],
  errors3: 0,
  errors2: 1,
  titleKey: 'lessons:pawn-wars.title',
  goalKey: 'lessons:pawn-wars.goal',
};

/** en locale with every `rewards:badges.<id>.name`/`.condition` this suite's fixtures reference. */
const LOCALES: Locales = {
  en: {
    rewards: {
      badges: {
        'has-name': { name: 'Has Name', condition: 'Do a thing' },
        'plural-one': {
          name: 'Plural',
          condition_one: 'Do {{count}} thing',
          condition_other: 'Do {{count}} things',
        },
      },
    },
  },
};

/** Loads `content` (written to a temp `badges.yaml`), returning issues instead of throwing. */
function loadIssues(content: string, locales: Locales = LOCALES): string[] {
  try {
    loadBadges(write(content), locales, CATALOG, [LESSON], [MINIGAME]);
    return [];
  } catch (error) {
    if (error instanceof ContentError) return [...error.issues];
    throw error;
  }
}

describe('loadBadges', () => {
  it('compiles a valid file to BadgeDef[], deriving name/condition keys from id', () => {
    const badges = loadBadges(
      write(`
badges:
  - id: has-name
    category: skill
    condition: { type: stars-total, thresholds: [50] }
`),
      LOCALES,
      CATALOG,
      [LESSON],
      [MINIGAME],
    );
    expect(badges).toEqual([
      {
        id: 'has-name',
        category: 'skill',
        nameKey: 'rewards:badges.has-name.name',
        conditionKey: 'rewards:badges.has-name.condition',
        condition: { type: 'stars-total', thresholds: [50] },
      },
    ]);
  });

  it('reports a duplicate badge id', () => {
    const issues = loadIssues(`
badges:
  - id: has-name
    category: skill
    condition: { type: stars-total, thresholds: [1] }
  - id: has-name
    category: skill
    condition: { type: stars-total, thresholds: [2] }
`);
    expect(issues).toEqual([expect.stringContaining('duplicate id')]);
  });

  it('reports non-ascending thresholds', () => {
    const issues = loadIssues(`
badges:
  - id: has-name
    category: skill
    condition: { type: stars-total, thresholds: [50, 50] }
`);
    expect(issues).toEqual([expect.stringContaining('thresholds must be strictly ascending')]);
  });

  it('reports a "mastered" condition with no scope', () => {
    const issues = loadIssues(`
badges:
  - id: has-name
    category: milestone
    condition: { type: mastered, thresholds: [1] }
`);
    expect(issues).toEqual([expect.stringContaining('requires "scope"')]);
  });

  it('reports a "mastered" scope referencing an unknown world', () => {
    const issues = loadIssues(`
badges:
  - id: has-name
    category: milestone
    condition: { type: mastered, scope: 'world:not-real', thresholds: [1] }
`);
    expect(issues).toEqual([expect.stringContaining('unknown world "not-real"')]);
  });

  it('reports a "mastered" scope referencing an unknown track', () => {
    const issues = loadIssues(`
badges:
  - id: has-name
    category: milestone
    condition: { type: mastered, scope: 'track:not-real', thresholds: [1] }
`);
    expect(issues).toEqual([expect.stringContaining('unknown track "not-real"')]);
  });

  it('reports a "mastered" scope in the wrong shape', () => {
    const issues = loadIssues(`
badges:
  - id: has-name
    category: milestone
    condition: { type: mastered, scope: 'board', thresholds: [1] }
`);
    expect(issues).toEqual([expect.stringContaining('scope must be')]);
  });

  it('reports a "concept-correct" condition with no concept', () => {
    const issues = loadIssues(`
badges:
  - id: has-name
    category: skill
    condition: { type: concept-correct, thresholds: [10] }
`);
    expect(issues).toEqual([expect.stringContaining('requires "concept"')]);
  });

  it('reports a "concept-correct" condition referencing an unknown concept', () => {
    const issues = loadIssues(`
badges:
  - id: has-name
    category: skill
    condition: { type: concept-correct, concept: not-real, thresholds: [10] }
`);
    expect(issues).toEqual([expect.stringContaining('unknown concept "not-real"')]);
  });

  it('reports both inARow and noHints set on the same condition', () => {
    const issues = loadIssues(`
badges:
  - id: has-name
    category: skill
    condition: { type: concept-correct, concept: rook-move, inARow: true, noHints: true, thresholds: [10] }
`);
    expect(issues).toEqual([expect.stringContaining('cannot both be set')]);
  });

  it('reports a "game-win" condition with neither opponent nor extra', () => {
    const issues = loadIssues(`
badges:
  - id: has-name
    category: play
    condition: { type: game-win, thresholds: [1] }
`);
    expect(issues).toEqual([expect.stringContaining('requires "opponent"')]);
  });

  it('reports a "game-win" opponent computer level out of range', () => {
    const issues = loadIssues(`
badges:
  - id: has-name
    category: play
    condition: { type: game-win, opponent: 'computer:9', thresholds: [1] }
`);
    expect(issues).toEqual([expect.stringContaining('must be a level 1-5')]);
  });

  it('reports a "game-win" opponent referencing an unknown mini-game', () => {
    const issues = loadIssues(`
badges:
  - id: has-name
    category: play
    condition: { type: game-win, opponent: not-real, thresholds: [1] }
`);
    expect(issues).toEqual([expect.stringContaining('unknown mini-game "not-real"')]);
  });

  it('accepts a "game-win" opponent naming a real mini-game', () => {
    expect(
      loadIssues(`
badges:
  - id: has-name
    category: play
    condition: { type: game-win, opponent: pawn-wars, thresholds: [3] }
`),
    ).toEqual([]);
  });

  it('reports "extra: queen-kept" combined with an opponent', () => {
    const issues = loadIssues(`
badges:
  - id: has-name
    category: play
    condition: { type: game-win, opponent: any, extra: queen-kept, thresholds: [1] }
`);
    expect(issues).toEqual([expect.stringContaining('does not take "opponent"')]);
  });

  it('reports a "game-event" condition with no event', () => {
    const issues = loadIssues(`
badges:
  - id: has-name
    category: skill
    condition: { type: game-event, thresholds: [10] }
`);
    expect(issues).toEqual([expect.stringContaining('requires "event"')]);
  });

  it('reports a "game-played" condition with no mode', () => {
    const issues = loadIssues(`
badges:
  - id: has-name
    category: play
    condition: { type: game-played, thresholds: [1] }
`);
    expect(issues).toEqual([expect.stringContaining('requires "mode"')]);
  });

  it('reports a missing name/condition locale key', () => {
    const issues = loadIssues(
      `
badges:
  - id: no-locale
    category: skill
    condition: { type: stars-total, thresholds: [1] }
`,
      { en: { rewards: {} } },
    );
    expect(issues).toEqual([
      expect.stringContaining('missing text key "rewards:badges.no-locale.name"'),
      expect.stringContaining('missing text key "rewards:badges.no-locale.condition"'),
    ]);
  });

  it('accepts a pluralized (`_one`/`_other`) condition key', () => {
    expect(
      loadIssues(`
badges:
  - id: plural-one
    category: skill
    condition: { type: stars-total, thresholds: [1] }
`),
    ).toEqual([]);
  });
});
