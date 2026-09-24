import { readFileSync } from 'node:fs';
import type { BadgeDef, Lesson, MiniGame, TracksCatalog } from '@chess-kids/core';
import { parse as parseYaml } from 'yaml';
import { checkTextKey, ContentError, type Locales } from './load.ts';
import { type BadgeConditionYaml, type BadgeYaml, badgesFileSchema } from './badges-schema.ts';

/** First line of an error's message, for compact single-line issue reporting. */
function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.split('\n')[0] ?? message;
}

const BOT_LEVELS = [1, 2, 3, 4, 5];

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

/**
 * Checks one badge's `condition` matches its `type`'s own required params (rewards.md §4) and that
 * every id it references (a world/track scope, a concept, an opponent level/mini-game) exists in
 * the compiled tracks catalog / lesson content.
 */
function validateCondition(
  id: string,
  condition: BadgeConditionYaml,
  catalog: TracksCatalog,
  lessons: readonly Lesson[],
  minigames: readonly MiniGame[],
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
    case 'game-win': {
      if (condition.extra === 'queen-kept') {
        if (condition.opponent !== undefined) {
          issues.push(`${where}: extra "queen-kept" does not take "opponent"`);
        }
        break;
      }
      if (condition.opponent === undefined) {
        issues.push(`${where}: type "game-win" requires "opponent" (or extra "queen-kept")`);
        break;
      }
      if (condition.opponent === 'any') break;
      if (condition.opponent.startsWith('computer:')) {
        const level = Number(condition.opponent.slice('computer:'.length));
        if (!BOT_LEVELS.includes(level)) {
          issues.push(
            `${where}: opponent "computer:<n>" must be a level 1-5, got "${condition.opponent}"`,
          );
        }
        break;
      }
      if (!minigames.some((game) => game.id === condition.opponent)) {
        issues.push(`${where}: opponent references unknown mini-game "${condition.opponent}"`);
      }
      break;
    }
    case 'game-event':
      if (condition.event === undefined) {
        issues.push(`${where}: type "game-event" requires "event"`);
      }
      break;
    case 'game-played':
      if (condition.mode === undefined) {
        issues.push(`${where}: type "game-played" requires "mode"`);
      }
      break;
    case 'stars-total':
    case 'perfect-lessons':
    case 'streak-days':
    case 'warmups':
    case 'comeback':
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

/**
 * Loads and validates `badges.yaml` (rewards.md §3-4), compiling it to `BadgeDef[]`. Cross-checks
 * every id a condition references against the compiled tracks/lesson/mini-game content, and that
 * both `rewards:badges.<id>.name` and `.condition` resolve in the `en` locale (derived from `id`,
 * not authored per-badge — same convention `characters.yaml` uses for its own name keys).
 */
export function loadBadges(
  filePath: string,
  locales: Locales,
  catalog: TracksCatalog,
  lessons: readonly Lesson[],
  minigames: readonly MiniGame[],
): readonly BadgeDef[] {
  let raw: string;
  try {
    raw = readFileSync(filePath, 'utf8');
  } catch (error) {
    throw new ContentError([`badges.yaml: cannot read file: ${errorMessage(error)}`]);
  }

  let parsed: unknown;
  try {
    parsed = parseYaml(raw, { uniqueKeys: true });
  } catch (error) {
    throw new ContentError([`badges.yaml: YAML syntax error: ${errorMessage(error)}`]);
  }

  const result = badgesFileSchema.safeParse(parsed);
  if (!result.success) {
    throw new ContentError(
      result.error.issues.map((issue) => {
        const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
        return `badges.yaml: ${path}: ${issue.message}`;
      }),
    );
  }

  const issues: string[] = [];
  const seenIds = new Set<string>();
  for (const badge of result.data.badges) {
    const where = `badges.yaml: badges.${badge.id}`;
    if (seenIds.has(badge.id)) {
      issues.push(`${where}: duplicate id`);
    }
    seenIds.add(badge.id);
    validateCondition(badge.id, badge.condition, catalog, lessons, minigames, issues);
    checkTextKey(`rewards:badges.${badge.id}.name`, locales, where, issues);
    checkTextKey(`rewards:badges.${badge.id}.condition`, locales, where, issues);
  }
  if (issues.length > 0) {
    throw new ContentError(issues);
  }

  return result.data.badges.map(compileBadge);
}
