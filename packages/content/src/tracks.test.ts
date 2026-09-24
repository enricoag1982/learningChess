import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadContent } from './lesson-load.ts';
import { loadLocales } from './load.ts';
import { loadTracks } from './tracks-load.ts';

const packageDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const locales = loadLocales(join(packageDir, 'locales'));
const content = loadContent(join(packageDir, 'lessons'), join(packageDir, 'minigames'), locales);
const catalog = loadTracks(
  join(packageDir, 'tracks.yaml'),
  locales,
  content.minigames,
  content.lessons,
);

describe('real tracks.yaml', () => {
  it('loads with no issues (loadTracks above did not throw)', () => {
    expect(catalog.tracks.length).toBeGreaterThan(0);
    expect(catalog.ranks.length).toBeGreaterThan(0);
  });

  it('World 3 (attack) has the world boss Win the Queen', () => {
    const attack = catalog.tracks.flatMap((track) => track.worlds).find((w) => w.id === 'attack');
    expect(attack?.boss).toBe('win-the-queen');
  });

  it('has exactly one main track: basics, with 5 worlds in order', () => {
    const mainTracks = catalog.tracks.filter((track) => track.kind === 'main');
    expect(mainTracks).toHaveLength(1);
    const [basics] = mainTracks;
    expect(basics?.id).toBe('basics');
    expect(basics?.worlds.map((world) => world.id)).toEqual([
      'board',
      'pieces',
      'attack',
      'check',
      'rules',
    ]);
  });

  it('has 3 branch tracks, each with exactly one world', () => {
    const branches = catalog.tracks.filter((track) => track.kind === 'branch');
    expect(branches.map((track) => track.id).sort()).toEqual(['endgames', 'openings', 'tactics']);
    for (const track of branches) {
      expect(track.worlds).toHaveLength(1);
    }
  });

  it('has the 6 ranks pawn through king, in order', () => {
    expect(catalog.ranks.map((rank) => rank.id)).toEqual([
      'pawn',
      'knight',
      'bishop',
      'rook',
      'queen',
      'king',
    ]);
  });
});
