import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { Lesson, MiniGame, Position } from '@chess-kids/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ContentError, loadLocales } from './load.ts';
import { loadTracks } from './tracks-load.ts';

/** Fixture position for `Lesson`/`MiniGame` fixtures below; its content is never exercised here. */
const EMPTY_POSITION = {
  pieces: {},
  markers: { stars: [], blocked: [] },
  toMove: 'w',
  castling: '-',
  enPassant: null,
} as unknown as Position;

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'chess-kids-tracks-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function write(relPath: string, content: string): void {
  const filePath = join(dir, relPath);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, 'utf8');
}

const JOURNEY_LOCALE = `
tracks:
  basics: Basics
  openings: Openings
worlds:
  board: Board
  pieces: Pieces
  openings: Openings
habitats:
  meadow: Meadow
  forest: Forest
ranks:
  pawn: Pawn
  knight: Knight
  queen: Queen
`;

const VALID_TRACKS = `
tracks:
  - id: basics
    kind: main
    title: tracks.basics
    worlds:
      - { id: board, order: 1, habitat: meadow, title: worlds.board }
      - { id: pieces, order: 2, habitat: meadow, title: worlds.pieces }
  - id: openings
    kind: branch
    title: tracks.openings
    worlds:
      - { id: openings, order: 1, habitat: forest, title: worlds.openings }
ranks:
  - { id: pawn, after: start }
  - { id: knight, after: world:pieces }
  - { id: queen, after: track:basics }
`;

/** Loads `dir/tracks.yaml` against `dir/locales`, returning issues instead of throwing. */
function issuesOf(minigames: readonly MiniGame[] = [], lessons: readonly Lesson[] = []): string[] {
  try {
    const locales = loadLocales(join(dir, 'locales'));
    loadTracks(join(dir, 'tracks.yaml'), locales, minigames, lessons);
    return [];
  } catch (error) {
    if (error instanceof ContentError) return [...error.issues];
    throw error;
  }
}

/** A minimal, otherwise-content-shaped lesson for `checkWorldBoss` fixture tests. */
function makeLesson(id: string, world: string): Lesson {
  return {
    id,
    world,
    order: 1,
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
    exercises: [],
  };
}

/** A minimal static mini-game unlocked by `unlockAfter`, for `checkWorldBoss` fixture tests. */
function makeMiniGame(id: string, unlockAfter: string): MiniGame {
  return {
    mode: 'static',
    id,
    concept: `${id}-concept`,
    titleKey: `minigames:${id}.title`,
    goalKey: `minigames:${id}.goal`,
    unlockAfter,
    position: EMPTY_POSITION,
    par: 5,
  };
}

describe('loadTracks', () => {
  it('loads a valid catalog into the expected shape', () => {
    write('locales/en/journey.yaml', JOURNEY_LOCALE);
    write('tracks.yaml', VALID_TRACKS);
    const locales = loadLocales(join(dir, 'locales'));

    const catalog = loadTracks(join(dir, 'tracks.yaml'), locales);

    expect(catalog.tracks).toHaveLength(2);
    const basics = catalog.tracks.find((track) => track.id === 'basics');
    expect(basics).toMatchObject({ id: 'basics', kind: 'main', titleKey: 'journey:tracks.basics' });
    expect(basics?.worlds).toEqual([
      {
        id: 'board',
        track: 'basics',
        order: 1,
        habitat: 'meadow',
        titleKey: 'journey:worlds.board',
      },
      {
        id: 'pieces',
        track: 'basics',
        order: 2,
        habitat: 'meadow',
        titleKey: 'journey:worlds.pieces',
      },
    ]);
    expect(catalog.ranks).toEqual([
      { id: 'pawn', after: 'start' },
      { id: 'knight', after: 'world:pieces' },
      { id: 'queen', after: 'track:basics' },
    ]);
  });

  it('rejects a duplicate track id', () => {
    write('locales/en/journey.yaml', JOURNEY_LOCALE);
    write(
      'tracks.yaml',
      `
tracks:
  - id: basics
    kind: main
    title: tracks.basics
    worlds: [ { id: board, order: 1, habitat: meadow, title: worlds.board } ]
  - id: basics
    kind: branch
    title: tracks.openings
    worlds: [ { id: pieces, order: 1, habitat: meadow, title: worlds.pieces } ]
ranks:
  - { id: pawn, after: start }
`,
    );

    expect(issuesOf()).toContainEqual(expect.stringContaining('duplicate id "basics"'));
  });

  it('rejects a duplicate world id across different tracks', () => {
    write('locales/en/journey.yaml', JOURNEY_LOCALE);
    write(
      'tracks.yaml',
      `
tracks:
  - id: basics
    kind: main
    title: tracks.basics
    worlds: [ { id: board, order: 1, habitat: meadow, title: worlds.board } ]
  - id: openings
    kind: branch
    title: tracks.openings
    worlds: [ { id: board, order: 1, habitat: forest, title: worlds.openings } ]
ranks:
  - { id: pawn, after: start }
`,
    );

    expect(issuesOf()).toContainEqual(expect.stringContaining('duplicate id "board"'));
  });

  it('rejects a duplicate order within one track', () => {
    write('locales/en/journey.yaml', JOURNEY_LOCALE);
    write(
      'tracks.yaml',
      `
tracks:
  - id: basics
    kind: main
    title: tracks.basics
    worlds:
      - { id: board, order: 1, habitat: meadow, title: worlds.board }
      - { id: pieces, order: 1, habitat: meadow, title: worlds.pieces }
ranks:
  - { id: pawn, after: start }
`,
    );

    expect(issuesOf()).toContainEqual(expect.stringContaining('duplicate order 1'));
  });

  it('allows the same order number reused across different tracks', () => {
    write('locales/en/journey.yaml', JOURNEY_LOCALE);
    write('tracks.yaml', VALID_TRACKS); // board and openings are both order 1, different tracks

    expect(issuesOf()).toEqual([]);
  });

  it('rejects zero main tracks', () => {
    write('locales/en/journey.yaml', JOURNEY_LOCALE);
    write(
      'tracks.yaml',
      `
tracks:
  - id: openings
    kind: branch
    title: tracks.openings
    worlds: [ { id: openings, order: 1, habitat: forest, title: worlds.openings } ]
ranks:
  - { id: pawn, after: start }
`,
    );

    expect(issuesOf()).toContainEqual(expect.stringContaining('exactly one "main" track, found 0'));
  });

  it('rejects two main tracks', () => {
    write('locales/en/journey.yaml', JOURNEY_LOCALE);
    write(
      'tracks.yaml',
      `
tracks:
  - id: basics
    kind: main
    title: tracks.basics
    worlds: [ { id: board, order: 1, habitat: meadow, title: worlds.board } ]
  - id: openings
    kind: main
    title: tracks.openings
    worlds: [ { id: openings, order: 1, habitat: forest, title: worlds.openings } ]
ranks:
  - { id: pawn, after: start }
`,
    );

    expect(issuesOf()).toContainEqual(expect.stringContaining('exactly one "main" track, found 2'));
  });

  it('rejects a habitat outside the fixed list', () => {
    write('locales/en/journey.yaml', JOURNEY_LOCALE);
    write(
      'tracks.yaml',
      `
tracks:
  - id: basics
    kind: main
    title: tracks.basics
    worlds: [ { id: board, order: 1, habitat: desert, title: worlds.board } ]
ranks:
  - { id: pawn, after: start }
`,
    );

    const issues = issuesOf();
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain('habitat');
  });

  it('rejects a rank referencing an unknown world', () => {
    write('locales/en/journey.yaml', JOURNEY_LOCALE);
    write(
      'tracks.yaml',
      `
tracks:
  - id: basics
    kind: main
    title: tracks.basics
    worlds: [ { id: board, order: 1, habitat: meadow, title: worlds.board } ]
ranks:
  - { id: pawn, after: start }
  - { id: knight, after: world:nope }
`,
    );

    expect(issuesOf()).toContainEqual(
      expect.stringContaining('after references unknown world "nope"'),
    );
  });

  it('rejects a rank referencing an unknown track', () => {
    write('locales/en/journey.yaml', JOURNEY_LOCALE);
    write(
      'tracks.yaml',
      `
tracks:
  - id: basics
    kind: main
    title: tracks.basics
    worlds: [ { id: board, order: 1, habitat: meadow, title: worlds.board } ]
ranks:
  - { id: pawn, after: start }
  - { id: queen, after: track:nope }
`,
    );

    expect(issuesOf()).toContainEqual(
      expect.stringContaining('after references unknown track "nope"'),
    );
  });

  it('rejects a missing track title text key', () => {
    write('locales/en/journey.yaml', 'worlds:\n  board: Board\nranks:\n  pawn: Pawn\n');
    write(
      'tracks.yaml',
      `
tracks:
  - id: basics
    kind: main
    title: tracks.basics
    worlds: [ { id: board, order: 1, habitat: meadow, title: worlds.board } ]
ranks:
  - { id: pawn, after: start }
`,
    );

    expect(issuesOf()).toContainEqual(
      expect.stringContaining('missing text key "journey:tracks.basics"'),
    );
  });

  it('rejects a missing habitat text key', () => {
    write(
      'locales/en/journey.yaml',
      'tracks:\n  basics: Basics\nworlds:\n  board: Board\nranks:\n  pawn: Pawn\n',
    );
    write(
      'tracks.yaml',
      `
tracks:
  - id: basics
    kind: main
    title: tracks.basics
    worlds: [ { id: board, order: 1, habitat: meadow, title: worlds.board } ]
ranks:
  - { id: pawn, after: start }
`,
    );

    expect(issuesOf()).toContainEqual(
      expect.stringContaining('missing text key "journey:habitats.meadow"'),
    );
  });

  it('rejects a missing rank text key', () => {
    write(
      'locales/en/journey.yaml',
      'tracks:\n  basics: Basics\nworlds:\n  board: Board\nhabitats:\n  meadow: Meadow\n',
    );
    write(
      'tracks.yaml',
      `
tracks:
  - id: basics
    kind: main
    title: tracks.basics
    worlds: [ { id: board, order: 1, habitat: meadow, title: worlds.board } ]
ranks:
  - { id: pawn, after: start }
`,
    );

    expect(issuesOf()).toContainEqual(
      expect.stringContaining('missing text key "journey:ranks.pawn"'),
    );
  });

  it('rejects an unknown track kind', () => {
    write('locales/en/journey.yaml', JOURNEY_LOCALE);
    write(
      'tracks.yaml',
      `
tracks:
  - id: basics
    kind: side
    title: tracks.basics
    worlds: [ { id: board, order: 1, habitat: meadow, title: worlds.board } ]
ranks:
  - { id: pawn, after: start }
`,
    );

    expect(issuesOf().length).toBeGreaterThan(0);
  });

  it('rejects a YAML syntax error', () => {
    write('locales/en/journey.yaml', JOURNEY_LOCALE);
    write('tracks.yaml', 'tracks: [unclosed\n');

    const issues = issuesOf();
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain('tracks.yaml');
    expect(issues[0]).toContain('YAML syntax error');
  });

  it('rejects a missing file', () => {
    write('locales/en/journey.yaml', JOURNEY_LOCALE);

    const issues = issuesOf();
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain('cannot read file');
  });

  const BOSS_TRACKS = `
tracks:
  - id: basics
    kind: main
    title: tracks.basics
    worlds:
      - { id: board, order: 1, habitat: meadow, title: worlds.board, boss: board-boss }
      - { id: pieces, order: 2, habitat: meadow, title: worlds.pieces }
ranks:
  - { id: pawn, after: start }
`;

  it('accepts a world boss referencing an existing mini-game unlocked by a lesson of that world', () => {
    write('locales/en/journey.yaml', JOURNEY_LOCALE);
    write('tracks.yaml', BOSS_TRACKS);
    const minigames = [makeMiniGame('board-boss', 'board-lesson')];
    const lessons = [makeLesson('board-lesson', 'board')];

    expect(issuesOf(minigames, lessons)).toEqual([]);

    const locales = loadLocales(join(dir, 'locales'));
    const catalog = loadTracks(join(dir, 'tracks.yaml'), locales, minigames, lessons);
    const board = catalog.tracks[0]?.worlds.find((world) => world.id === 'board');
    expect(board?.boss).toBe('board-boss');
  });

  it('rejects a world boss referencing an unknown mini-game', () => {
    write('locales/en/journey.yaml', JOURNEY_LOCALE);
    write('tracks.yaml', BOSS_TRACKS);

    // No minigames/lessons passed: "board-boss" cannot be found.
    expect(issuesOf()).toContainEqual(
      expect.stringContaining('boss references unknown mini-game "board-boss"'),
    );
  });

  it('rejects a world boss whose mini-game unlocks after a lesson from a different world', () => {
    write('locales/en/journey.yaml', JOURNEY_LOCALE);
    write('tracks.yaml', BOSS_TRACKS);
    const minigames = [makeMiniGame('board-boss', 'pieces-lesson')];
    const lessons = [makeLesson('pieces-lesson', 'pieces')]; // wrong world: not "board"

    expect(issuesOf(minigames, lessons)).toContainEqual(
      expect.stringContaining('is not a lesson of this world'),
    );
  });
});
