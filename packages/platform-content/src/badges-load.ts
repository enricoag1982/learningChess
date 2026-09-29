import type { BadgeDef, Lesson, MiniGame, TracksCatalog } from '@learn/platform-core';
import { checkTextKey, ContentError, type Locales } from './load.ts';
import { loadYaml } from './yaml-file.ts';
import { type BadgeConditionYaml, type BadgeYaml, badgesFileSchema } from './badges-schema.ts';
import type { BadgesContent } from './subject.ts';

/** Every concept id any authored lesson teaches (a lesson's own `concept`, plus per-exercise ones). */
function allConceptIds(lessons: readonly Lesson[]): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const lesson of lessons) {
    ids.add(lesson.concept);
    for (const exercise of lesson.exercises) {
      ids.add(exercise.concept);
    }
  }
  return ids;
}

/** Every condition type this file itself knows how to validate; anything else goes to the
 * subject's own `badges.validate` (chess: `game-win`/`game-event`/`game-played`). */
const GENERIC_CONDITION_TYPES = new Set([
  'mastered',
  'concept-correct',
  'stars-total',
  'perfect-lessons',
  'streak-days',
  'warmups',
  'comeback',
]);

/** Checks one badge's `condition` matches its `type`'s own required params and that every id it
 * references exists in the compiled tracks catalog / lesson content. */
function validateCondition(
  id: string,
  condition: BadgeConditionYaml,
  catalog: TracksCatalog,
  lessons: readonly Lesson[],
  minigames: readonly MiniGame[],
  badges: BadgesContent,
  issues: string[],
): void {
  const where = `badges.yaml: badges.${id}.condition`;
  const thresholds = condition.thresholds;
  for (let i = 1; i < thresholds.length; i += 1) {
    const previous = thresholds[i - 1] ?? 0;
    const current = thresholds[i] ?? 0;
    if (current <= previous) {
      issues.push(
        `${where}: thresholds must be strictly ascending, got [${thresholds.join(', ')}]`,
      );
      break;
    }
  }

  if (!GENERIC_CONDITION_TYPES.has(condition.type)) {
    const minigameIds = new Set(minigames.map((game) => game.id));
    badges.validate(condition, { where, issues }, { minigameIds });
    return;
  }

  switch (condition.type) {
    case 'mastered': {
      if (condition.scope === undefined) {
        issues.push(`${where}: type "mastered" requires "scope"`);
        break;
      }
      if (condition.scope.startsWith('world:')) {
        const worldId = condition.scope.slice('world:'.length);
        const found = catalog.tracks.some((track) => track.worlds.some((w) => w.id === worldId));
        if (!found) issues.push(`${where}: scope references unknown world "${worldId}"`);
      } else if (condition.scope.startsWith('track:')) {
        const trackId = condition.scope.slice('track:'.length);
        if (!catalog.tracks.some((track) => track.id === trackId)) {
          issues.push(`${where}: scope references unknown track "${trackId}"`);
        }
      } else {
        issues.push(
          `${where}: scope must be "world:<id>" or "track:<id>", got "${condition.scope}"`,
        );
      }
      break;
    }
    case 'concept-correct': {
      if (condition.concept === undefined) {
        issues.push(`${where}: type "concept-correct" requires "concept"`);
        break;
      }
      if (condition.inARow === true && condition.noHints === true) {
        issues.push(`${where}: "inARow" and "noHints" cannot both be set`);
      }
      if (!allConceptIds(lessons).has(condition.concept)) {
        issues.push(`${where}: concept references unknown concept "${condition.concept}"`);
      }
      break;
    }
    case 'stars-total':
    case 'perfect-lessons':
    case 'streak-days':
    case 'warmups':
    case 'comeback':
      break;
    default:
      break;
  }
}

function compileBadge(raw: BadgeYaml): BadgeDef {
  return {
    id: raw.id,
    category: raw.category,
    nameKey: `rewards:badges.${raw.id}.name`,
    conditionKey: `rewards:badges.${raw.id}.condition`,
    condition: raw.condition,
  };
}

/** Loads and validates `badges.yaml`, compiling it to `BadgeDef[]`. Cross-checks every id a
 * condition references, and that its name/condition text keys (derived from `id`) resolve. */
export function loadBadges(
  filePath: string,
  locales: Locales,
  catalog: TracksCatalog,
  lessons: readonly Lesson[],
  minigames: readonly MiniGame[],
  badges: BadgesContent,
): readonly BadgeDef[] {
  const loaded = loadYaml(filePath, 'badges.yaml', badgesFileSchema(badges.fields));
  if ('issues' in loaded) {
    throw new ContentError(loaded.issues);
  }

  const issues: string[] = [];
  const seenIds = new Set<string>();
  for (const badge of loaded.data.badges) {
    const where = `badges.yaml: badges.${badge.id}`;
    if (seenIds.has(badge.id)) {
      issues.push(`${where}: duplicate id`);
    }
    seenIds.add(badge.id);
    validateCondition(badge.id, badge.condition, catalog, lessons, minigames, badges, issues);
    checkTextKey(`rewards:badges.${badge.id}.name`, locales, where, issues);
    checkTextKey(`rewards:badges.${badge.id}.condition`, locales, where, issues);
  }
  if (issues.length > 0) {
    throw new ContentError(issues);
  }

  return loaded.data.badges.map(compileBadge);
}
