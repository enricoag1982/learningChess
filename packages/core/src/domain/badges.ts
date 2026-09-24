import type { StoredRecord } from './profile.ts';

/** Badge catalogue category (rewards.md §3). */
export type BadgeCategory = 'milestone' | 'skill' | 'play' | 'habit';

/** Reward tier shown on an earned badge (rewards.md §1 "Clear goals"); `undefined` = no tiers. */
export type BadgeTier = 'bronze' | 'silver' | 'gold';

/** Every badge condition type (rewards.md §4), plus the params each one reads off `BadgeCondition`. */
export type BadgeConditionType =
  | 'mastered'
  | 'stars-total'
  | 'perfect-lessons'
  | 'concept-correct'
  | 'game-win'
  | 'game-event'
  | 'game-played'
  | 'streak-days'
  | 'warmups'
  | 'comeback';

/**
 * One badge's earning rule (rewards.md §4), compiled from `packages/content/badges.yaml`. Every
 * type is evaluated against `thresholds` (ascending, 1–3 entries: a single-tier badge has one
 * entry, a tiered one three — `evaluateBadges` names them bronze/silver/gold in order); the other
 * fields narrow *what* is counted, one or two of them set per `type` (see the doc on each).
 */
export interface BadgeCondition {
  readonly type: BadgeConditionType;
  readonly thresholds: readonly number[];
  /** `mastered`: `'world:<id>'` or `'track:<id>'`. */
  readonly scope?: string;
  /** `concept-correct`: the concept id (e.g. `hanging-piece`). */
  readonly concept?: string;
  /** `concept-correct`: count the current correct-in-a-row streak (Sharp Eyes), not a lifetime total. */
  readonly inARow?: boolean;
  /** `concept-correct`: count the current hint-free-in-a-row streak (Escape Artist). */
  readonly noHints?: boolean;
  /** `game-win`: `'any'` (any computer win), `'computer:<level>'`, or a mini-game id (e.g. `pawn-wars`). */
  readonly opponent?: string;
  /** `game-win`: `'queen-kept'` counts wins where the kid's queen was never captured, ignoring `opponent`. */
  readonly extra?: 'queen-kept';
  /** `game-event`: which `GameRecord.moves` pattern to count. */
  readonly event?: 'promotion' | 'castling';
  /** `game-played`: `'local'` (vs a friend, profile-metadata driven — M4.3). */
  readonly mode?: 'local';
}

/** One badge definition, compiled from content (domain-model.md §1 `BadgeDef`). */
export interface BadgeDef {
  readonly id: string;
  readonly category: BadgeCategory;
  /** Locale key of the badge's display name, e.g. `rewards:badges.first-win.name`. */
  readonly nameKey: string;
  /** Locale key of its spoken/shown condition (pluralized on `count`), e.g. `rewards:badges.first-win.condition`. */
  readonly conditionKey: string;
  readonly condition: BadgeCondition;
}

/** One earned badge/tier (domain-model.md §2 `Badge`); a tiered badge gets one row per tier reached. */
export interface EarnedBadge extends StoredRecord {
  readonly profileId: string;
  readonly badgeId: string;
  readonly tier?: BadgeTier;
  /** ISO timestamp this tier was reached. */
  readonly at: string;
  /** Cleared once shown in a celebration or seen in My Den ("new" dot, rewards.md §1). */
  readonly seen: boolean;
}

/**
 * Every fact the badge engine reads, derived from stored profile data + content (`app/rewards.ts`
 * builds this) — the engine itself never reads progress/attempts/game records directly, keeping
 * `evaluateBadges` pure and easy to test with plain numbers.
 */
export interface BadgeFacts {
  /** Mastered worlds/tracks, as `'world:<id>'` / `'track:<id>'` (domain-model.md §3). */
  readonly masteredScopes: ReadonlySet<string>;
  readonly starsTotal: number;
  /** Lessons with 3 stars on every exercise (rewards.md §3 "Perfect Lesson"). */
  readonly perfectLessons: number;
  /** Lifetime correct-solve count per concept id (e.g. Mate Master's `mate-in-1`). */
  readonly conceptCorrectTotal: Readonly<Record<string, number>>;
  /** Current correct-in-a-row streak per concept id (Sharp Eyes). */
  readonly conceptCorrectInARow: Readonly<Record<string, number>>;
  /** Current hint-free-in-a-row streak per concept id (Escape Artist). */
  readonly conceptNoHintsInARow: Readonly<Record<string, number>>;
  /** Win counts keyed like `BadgeCondition.opponent`: `'any'`, `'computer:<n>'`, a mini-game id. */
  readonly gameWins: Readonly<Record<string, number>>;
  /** Wins where the kid's queen was never captured (Queen Keeper). */
  readonly queenKeptWins: number;
  /** Promotion move count / games-with-a-castle count, across all non-abandoned games. */
  readonly gameEvents: Readonly<{ promotion: number; castling: number }>;
  /** Games played vs a friend (`opponent` starting `profile:`/`guest` — M4.3, Friendly Match). */
  readonly localGamesPlayed: number;
  /** Today's streak, after folding in today's activity (Daily Player). */
  readonly streakCurrent: number;
  readonly warmupsCompleted: number;
  /** Scored exercises finished (any stars) after >= 2 wrong tries (Never Give Up). */
  readonly comebackCount: number;
}

/** Tier names in threshold order, sliced to how many thresholds a condition actually has. */
const TIER_NAMES: readonly BadgeTier[] = ['bronze', 'silver', 'gold'];

/** The single number `condition.type` is measured against, read off `facts`. */
function factValue(condition: BadgeCondition, facts: BadgeFacts): number {
  switch (condition.type) {
    case 'mastered':
      return condition.scope !== undefined && facts.masteredScopes.has(condition.scope) ? 1 : 0;
    case 'stars-total':
      return facts.starsTotal;
    case 'perfect-lessons':
      return facts.perfectLessons;
    case 'concept-correct': {
      const concept = condition.concept ?? '';
      if (condition.inARow) return facts.conceptCorrectInARow[concept] ?? 0;
      if (condition.noHints) return facts.conceptNoHintsInARow[concept] ?? 0;
      return facts.conceptCorrectTotal[concept] ?? 0;
    }
    case 'game-win':
      return condition.extra === 'queen-kept'
        ? facts.queenKeptWins
        : (facts.gameWins[condition.opponent ?? 'any'] ?? 0);
    case 'game-event':
      return facts.gameEvents[condition.event ?? 'promotion'];
    case 'game-played':
      return facts.localGamesPlayed;
    case 'streak-days':
      return facts.streakCurrent;
    case 'warmups':
      return facts.warmupsCompleted;
    case 'comeback':
      return facts.comebackCount;
  }
}

/** One badge newly earned by `evaluateBadges`: its id and tier (`undefined` for a single-tier badge). */
export interface NewlyEarnedBadge {
  readonly badgeId: string;
  readonly tier?: BadgeTier;
}

/** `"<badgeId>:<tier>"` key, `tier` blank for an untiered badge — how `evaluateBadges` dedupes against `earned`. */
function earnedKey(badgeId: string, tier: BadgeTier | undefined): string {
  return `${badgeId}:${tier ?? ''}`;
}

/**
 * Pure badge engine (rewards.md §4): for every `defs` entry, compares its current fact value
 * against each of its `thresholds` (ascending) and returns every tier newly crossed that is not
 * already in `earned` — in catalogue order, tiers low-to-high. Badges never lost (rewards.md §1):
 * this only ever adds, and a fact value dropping later (e.g. a streak resetting) does not affect
 * what is already in `earned`, since this function never removes anything itself.
 */
export function evaluateBadges(
  defs: readonly BadgeDef[],
  facts: BadgeFacts,
  earned: readonly EarnedBadge[],
): readonly NewlyEarnedBadge[] {
  const alreadyEarned = new Set(earned.map((entry) => earnedKey(entry.badgeId, entry.tier)));
  const newlyEarned: NewlyEarnedBadge[] = [];

  for (const def of defs) {
    const value = factValue(def.condition, facts);
    const thresholds = def.condition.thresholds;
    const tiered = thresholds.length > 1;
    thresholds.forEach((threshold, index) => {
      if (value < threshold) return;
      const tier = tiered ? TIER_NAMES[index] : undefined;
      if (alreadyEarned.has(earnedKey(def.id, tier))) return;
      alreadyEarned.add(earnedKey(def.id, tier));
      newlyEarned.push({ badgeId: def.id, tier });
    });
  }

  return newlyEarned;
}

/** Fresh, unsaved `EarnedBadge` row for `badgeId`/`tier`, freshly earned at `now`. */
export function newEarnedBadge(
  id: string,
  profileId: string,
  badgeId: string,
  tier: BadgeTier | undefined,
  now: Date,
): EarnedBadge {
  const nowIso = now.toISOString();
  return {
    id,
    profileId,
    badgeId,
    ...(tier === undefined ? {} : { tier }),
    at: nowIso,
    seen: false,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

/** Marks one earned badge/tier `seen: true` (My Den's "new" dot, rewards.md §1). No-op if unchanged. */
export function markSeen(badge: EarnedBadge, now: Date): EarnedBadge {
  if (badge.seen) return badge;
  return { ...badge, seen: true, updatedAt: now.toISOString() };
}
