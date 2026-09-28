import type { StoredRecord } from './profile.ts';
import type { GameRecord } from './progress.ts';

/** Badge catalogue category. */
export type BadgeCategory = 'milestone' | 'skill' | 'play' | 'habit';

/** Reward tier shown on an earned badge; `undefined` = no tiers. */
export type BadgeTier = 'bronze' | 'silver' | 'gold';

/** Every badge condition type, plus the params each one reads off `BadgeCondition`. */
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

/** One badge's earning rule, compiled from `packages/content/badges.yaml`. Every type is evaluated
 * against `thresholds` (ascending, 1–3 entries — `evaluateBadges` names them bronze/silver/gold);
 * the other fields narrow *what* is counted, one or two set per `type`. */
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
  /** `game-played`: `'local'` (vs a friend). */
  readonly mode?: 'local';
}

/** One badge definition, compiled from content. */
export interface BadgeDef {
  readonly id: string;
  readonly category: BadgeCategory;
  /** Locale key of the badge's display name, e.g. `rewards:badges.first-win.name`. */
  readonly nameKey: string;
  /** Locale key of its spoken/shown condition (pluralized on `count`), e.g. `rewards:badges.first-win.condition`. */
  readonly conditionKey: string;
  readonly condition: BadgeCondition;
}

/** One earned badge/tier; a tiered badge gets one row per tier reached. */
export interface EarnedBadge extends StoredRecord {
  readonly profileId: string;
  readonly badgeId: string;
  readonly tier?: BadgeTier;
  /** ISO timestamp this tier was reached. */
  readonly at: string;
  /** Cleared once shown in a celebration or seen in My Den ("new" dot). */
  readonly seen: boolean;
}

/** Every fact the badge engine's own 7 generic condition types read, derived from stored profile
 * data + content (`app/rewards.ts` builds this) — the engine itself never reads
 * progress/attempts/game records directly. The other 3 types (`game-win`/`game-event`/
 * `game-played`) read the subject's own facts instead (`SubjectCore.rewards`). */
export interface BadgeFacts {
  /** Mastered worlds/tracks, as `'world:<id>'` / `'track:<id>'`. */
  readonly masteredScopes: ReadonlySet<string>;
  readonly starsTotal: number;
  /** Lessons with 3 stars on every exercise. */
  readonly perfectLessons: number;
  /** Lifetime correct-solve count per concept id. */
  readonly conceptCorrectTotal: Readonly<Record<string, number>>;
  /** Current correct-in-a-row streak per concept id. */
  readonly conceptCorrectInARow: Readonly<Record<string, number>>;
  /** Current hint-free-in-a-row streak per concept id. */
  readonly conceptNoHintsInARow: Readonly<Record<string, number>>;
  /** Today's streak, after folding in today's activity. */
  readonly streakCurrent: number;
  readonly warmupsCompleted: number;
  /** Scored exercises finished (any stars) after >= 2 wrong tries. */
  readonly comebackCount: number;
}

/** A subject's own badge-condition delegate (`SubjectCore.rewards.conditionValue`): the fact value
 * for a condition type the engine's own 7 don't cover, or `undefined` for one of those 7. */
/** Method syntax deliberate (bivariant parameter checking, same reason as `ExerciseKind`/
 * `MiniGameMode`): lets a subject's precise `SubjectRewards<ChessRewardFacts>` widen to
 * `SubjectRewards<unknown>` with no cast. */
export interface SubjectRewards<F> {
  facts(records: readonly GameRecord[]): F;
  conditionValue(condition: BadgeCondition, facts: F): number | undefined;
}

/** Tier names in threshold order, sliced to how many thresholds a condition actually has. */
const TIER_NAMES: readonly BadgeTier[] = ['bronze', 'silver', 'gold'];

/** The single number `condition.type` is measured against: one of the engine's own 7 generic types
 * read off `facts`, or one of a subject's own 3 (`subject.conditionValue(condition, subjectFacts)`,
 * `0` with no subject rewards wired up or no subject facts given). */
function factValue<F>(
  condition: BadgeCondition,
  facts: BadgeFacts,
  subject?: SubjectRewards<F>,
  subjectFacts?: F,
): number {
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
    case 'streak-days':
      return facts.streakCurrent;
    case 'warmups':
      return facts.warmupsCompleted;
    case 'comeback':
      return facts.comebackCount;
    case 'game-win':
    case 'game-event':
    case 'game-played':
      if (subject === undefined || subjectFacts === undefined) return 0;
      return subject.conditionValue(condition, subjectFacts) ?? 0;
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

/** Pure badge engine: for every `defs` entry, compares its current fact value against each of its
 * `thresholds` and returns every tier newly crossed not already in `earned`. Badges never lost:
 * this only ever adds. `subject`/`subjectFacts` are the subject's own `game-win`/`game-event`/
 * `game-played` delegate (`SubjectCore.rewards`); omitted, those 3 types never earn. */
export function evaluateBadges<F = unknown>(
  defs: readonly BadgeDef[],
  facts: BadgeFacts,
  earned: readonly EarnedBadge[],
  subject?: SubjectRewards<F>,
  subjectFacts?: F,
): readonly NewlyEarnedBadge[] {
  const alreadyEarned = new Set(earned.map((entry) => earnedKey(entry.badgeId, entry.tier)));
  const newlyEarned: NewlyEarnedBadge[] = [];

  for (const def of defs) {
    const value = factValue(def.condition, facts, subject, subjectFacts);
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

/** Marks one earned badge/tier `seen: true` (My Den's "new" dot). No-op if unchanged. */
export function markSeen(badge: EarnedBadge, now: Date): EarnedBadge {
  if (badge.seen) return badge;
  return { ...badge, seen: true, updatedAt: now.toISOString() };
}
