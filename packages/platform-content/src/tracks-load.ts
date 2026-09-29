import type { Lesson, MiniGame, RankDef, Track, TracksCatalog, World } from '@learn/platform-core';
import { checkTextKey, ContentError, type Locales } from './load.ts';
import { loadYaml } from './yaml-file.ts';
import {
  type RankYaml,
  type TrackYaml,
  type WorldYaml,
  tracksFileSchema,
} from './tracks-schema.ts';

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

function claimId(claimed: Map<string, string>, id: string, where: string, issues: string[]): void {
  const claimedAt = claimed.get(id);
  if (claimedAt !== undefined) {
    issues.push(`${where}: duplicate id "${id}" (already used at ${claimedAt})`);
    return;
  }
  claimed.set(id, where);
}

/** A world's `boss` (if set) references an existing mini-game whose `unlockAfter` is a lesson of this world. */
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

/** Cross-record checks the schema cannot express alone: ids unique, orders unique within a track,
 * exactly one main track, rank `after` references an existing world/track, text keys resolve. */
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

/** Loads and validates `tracks.yaml`, compiling it to `TracksCatalog`. `minigames`/`lessons`
 * validate world bosses' cross-references; omit where that check does not matter. */
export function loadTracks(
  filePath: string,
  locales: Locales,
  minigames: readonly MiniGame[] = [],
  lessons: readonly Lesson[] = [],
): TracksCatalog {
  const loaded = loadYaml(filePath, 'tracks.yaml', tracksFileSchema);
  if ('issues' in loaded) {
    throw new ContentError(loaded.issues);
  }

  const catalog: TracksCatalog = {
    tracks: loaded.data.tracks.map(compileTrack),
    ranks: loaded.data.ranks.map(compileRank),
  };

  const issues: string[] = [];
  validateSemantics(catalog, locales, minigames, lessons, issues);
  if (issues.length > 0) {
    throw new ContentError(issues);
  }

  return catalog;
}
