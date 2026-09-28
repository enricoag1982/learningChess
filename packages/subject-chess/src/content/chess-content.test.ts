import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TracksCatalog } from '@learn/platform-core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadBadges } from '@learn/platform-content/badges-load';
import { chessBadges } from './chess-content.ts';
import { ContentError, type Locales } from '@learn/platform-content/load';

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

const CATALOG: TracksCatalog = { tracks: [], ranks: [] };

const MINIGAME = {
  mode: 'series' as const,
  id: 'pawn-wars',
  concept: 'pawn-move',
  unlockAfter: 'rook',
  rounds: [],
  errors3: 0,
  errors2: 1,
  titleKey: 'lessons:pawn-wars.title',
  goalKey: 'lessons:pawn-wars.goal',
};

const LOCALES: Locales = {
  en: { rewards: { badges: { 'has-name': { name: 'Has Name', condition: 'Do a thing' } } } },
};

/** Loads `content` (written to a temp `badges.yaml`) via chess's own badge fields/validation,
 * returning issues instead of throwing. */
function loadIssues(content: string): string[] {
  try {
    loadBadges(write(content), LOCALES, CATALOG, [], [MINIGAME], chessBadges);
    return [];
  } catch (error) {
    if (error instanceof ContentError) return [...error.issues];
    throw error;
  }
}

describe('chessBadges.validate', () => {
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
});
