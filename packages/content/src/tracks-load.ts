import { readFileSync } from 'node:fs';
import type { Lesson, MiniGame, RankDef, Track, TracksCatalog, World } from '@chess-kids/core';
import { parse as parseYaml } from 'yaml';
import type { ZodError } from 'zod';
import { ContentError, type Locales } from './load.ts';
import type { LocaleTree } from './schema.ts';
import {
  type RankYaml,
  type TrackYaml,
  type WorldYaml,
  tracksFileSchema,
} from './tracks-schema.ts';

/** First line of an error's message, for compact single-line issue reporting. */
function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.split('\n')[0] ?? message;
}

function formatZodIssues(relPath: string, error: ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
    return `${relPath}: ${path}: ${issue.message}`;
  });
}

/** Looks up a dot-separated key path in a locale tree (e.g. `tracks.basics`). */
function hasKeyPath(tree: LocaleTree, dotPath: string): boolean {
  let node: LocaleTree | string = tree;
  for (const segment of dotPath.split('.')) {
    if (typeof node === 'string') {
      return false;
    }
    const child: LocaleTree | string | undefined = node[segment];
    if (child === undefined) {
      return false;
    }
    node = child;
  }
  return typeof node === 'string';
}

/** Checks that `fullKey` (e.g. `journey:tracks.basics`) resolves to a leaf in the `en` locale. */
function checkTextKey(fullKey: string, locales: Locales, where: string, issues: string[]): void {
  const separatorIndex = fullKey.indexOf(':');
  const namespace = separatorIndex < 0 ? '' : fullKey.slice(0, separatorIndex);
  const dotPath = separatorIndex < 0 ? '' : fullKey.slice(separatorIndex + 1);
  const tree = locales.en?.[namespace];
  if (tree === undefined || dotPath === '' || !hasKeyPath(tree, dotPath)) {
    issues.push(`${where}: missing text key "${fullKey}" in en locale`);
  }
}

function compileWorld(raw: WorldYaml, trackId: string): World {
  return {
    id: raw.id,
    track: trackId,
    order: raw.order,
    habitat: raw.habitat,
    titleKey: `journey:${raw.title}`,
    ...(raw.boss === undefined ? {} : { boss: raw.boss }),
  };
}

function compileTrack(raw: TrackYaml): Track {
  return {
    id: raw.id,
    kind: raw.kind,
    titleKey: `journey:${raw.title}`,
    worlds: raw.worlds.map((world) => compileWorld(world, raw.id)),
  };
}

function compileRank(raw: RankYaml): RankDef {
  return { id: raw.id, after: raw.after };
}

/** Claims `id` in `claimed`, pushing a duplicate-id issue (with `where`) if already claimed. */
function claimId(claimed: Map<string, string>, id: string, where: string, issues: string[]): void {
  const claimedAt = claimed.get(id);
  if (claimedAt !== undefined) {
    issues.push(`${where}: duplicate id "${id}" (already used at ${claimedAt})`);
    return;
  }
  claimed.set(id, where);
}

/**
 * Checks one world's `boss` (if set) references an existing mini-game, and that mini-game's
 * `unlockAfter` names a lesson of this same world (build-time check, domain-model.md §3: a world
 * boss's Play tile must unlock alongside the world it belongs to).
 */
function checkWorldBoss(
  world: World,
  worldWhere: string,
  minigames: readonly MiniGame[],
  lessons: readonly Lesson[],
  issues: string[],
): void {
  if (world.boss === undefined) {
    return;
  }
  const minigame = minigames.find((candidate) => candidate.id === world.boss);
  if (minigame === undefined) {
    issues.push(`${worldWhere}: boss references unknown mini-game "${world.boss}"`);
    return;
  }
  const lesson = lessons.find((candidate) => candidate.id === minigame.unlockAfter);
  if (lesson === undefined || lesson.world !== world.id) {
    issues.push(
      `${worldWhere}: boss mini-game "${world.boss}" unlocks after lesson ` +
        `"${minigame.unlockAfter}", which is not a lesson of this world`,
    );
  }
}

/**
 * Cross-record checks the schema cannot express alone: ids unique (per kind), orders unique
 * within a track, exactly one main track, rank `after` references an existing world/track, every
 * title/habitat/rank text key resolves in the `en` locale, and every world boss references a real
 * mini-game unlocked by one of that world's own lessons.
 */
function validateSemantics(
  catalog: TracksCatalog,
  locales: Locales,
  minigames: readonly MiniGame[],
  lessons: readonly Lesson[],
  issues: string[],
): void {
  const trackIds = new Map<string, string>();
  const worldIds = new Map<string, string>();
  const rankIds = new Map<string, string>();
  let mainTrackCount = 0;

  for (const track of catalog.tracks) {
    const trackWhere = `tracks.yaml: tracks.${track.id}`;
    claimId(trackIds, track.id, trackWhere, issues);
    checkTextKey(track.titleKey, locales, trackWhere, issues);
    if (track.kind === 'main') {
      mainTrackCount += 1;
    }

    const orders = new Map<number, string>();
    for (const world of track.worlds) {
      const worldWhere = `tracks.yaml: tracks.${track.id}.worlds.${world.id}`;
      claimId(worldIds, world.id, worldWhere, issues);
      checkTextKey(world.titleKey, locales, worldWhere, issues);
      checkWorldBoss(world, worldWhere, minigames, lessons, issues);

      const orderClaimedAt = orders.get(world.order);
      if (orderClaimedAt !== undefined) {
        issues.push(
          `${worldWhere}: duplicate order ${String(world.order)} in track "${track.id}" (already used at ${orderClaimedAt})`,
        );
      } else {
        orders.set(world.order, worldWhere);
      }
    }
  }

  if (mainTrackCount !== 1) {
    issues.push(`tracks.yaml: expected exactly one "main" track, found ${String(mainTrackCount)}`);
  }

  for (const rank of catalog.ranks) {
    const rankWhere = `tracks.yaml: ranks.${rank.id}`;
    claimId(rankIds, rank.id, rankWhere, issues);
    checkTextKey(`journey:ranks.${rank.id}`, locales, rankWhere, issues);

    if (rank.after.startsWith('world:')) {
      const worldId = rank.after.slice('world:'.length);
      if (!worldIds.has(worldId)) {
        issues.push(`${rankWhere}: after references unknown world "${worldId}"`);
      }
    } else if (rank.after.startsWith('track:')) {
      const trackId = rank.after.slice('track:'.length);
      if (!trackIds.has(trackId)) {
        issues.push(`${rankWhere}: after references unknown track "${trackId}"`);
      }
    }
  }

  const habitats = new Set(
    catalog.tracks.flatMap((track) => track.worlds.map((world) => world.habitat)),
  );
  for (const habitat of habitats) {
    checkTextKey(`journey:habitats.${habitat}`, locales, 'tracks.yaml: habitats', issues);
  }
}

/**
 * Loads and validates `tracks.yaml`, compiling it to `TracksCatalog`. Collects every issue
 * (parse, schema and semantic) before throwing a single `ContentError`. `minigames`/`lessons`
 * (the compiled content, from `loadContent`) validate world bosses' cross-references; omit them
 * only where that check does not matter (e.g. a fixture with no `boss:` set).
 */
export function loadTracks(
  filePath: string,
  locales: Locales,
  minigames: readonly MiniGame[] = [],
  lessons: readonly Lesson[] = [],
): TracksCatalog {
  let raw: string;
  try {
    raw = readFileSync(filePath, 'utf8');
  } catch (error) {
    throw new ContentError([`tracks.yaml: cannot read file: ${errorMessage(error)}`]);
  }

  let parsed: unknown;
  try {
    parsed = parseYaml(raw, { uniqueKeys: true });
  } catch (error) {
    throw new ContentError([`tracks.yaml: YAML syntax error: ${errorMessage(error)}`]);
  }

  const result = tracksFileSchema.safeParse(parsed);
  if (!result.success) {
    throw new ContentError(formatZodIssues('tracks.yaml', result.error));
  }

  const catalog: TracksCatalog = {
    tracks: result.data.tracks.map(compileTrack),
    ranks: result.data.ranks.map(compileRank),
  };

  const issues: string[] = [];
  validateSemantics(catalog, locales, minigames, lessons, issues);
  if (issues.length > 0) {
    throw new ContentError(issues);
  }

  return catalog;
}
