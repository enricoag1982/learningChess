import type { StoredRecord } from './profile.ts';
import type { GameRecord } from './progress.ts';

export type BadgeCategory = 'milestone' | 'skill' | 'play' | 'habit';

export type BadgeTier = 'bronze' | 'silver' | 'gold';

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

/** Compiled from `badges.yaml`. `thresholds`: ascending, 1–3 entries (bronze/silver/gold);
 * the other fields narrow what is counted, per `type`. */
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

export interface BadgeDef {
  readonly id: string;
  readonly category: BadgeCategory;
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
  readonly at: string;
  /** Cleared once shown in a celebration or seen in My Den ("new" dot). */
  readonly seen: boolean;
}

/** Facts the engine's 7 generic condition types read (`app/rewards.ts` builds them from stored data + content);
 * the 3 `game-*` types read the subject's own facts. */
export interface BadgeFacts {
  /** Mastered worlds/tracks, as `'world:<id>'` / `'track:<id>'`. */
  readonly masteredScopes: ReadonlySet<string>;
  readonly starsTotal: number;
  /** Lessons with 3 stars on every exercise. */
  readonly perfectLessons: number;
  readonly conceptCorrectTotal: Readonly<Record<string, number>>;
  readonly conceptCorrectInARow: Readonly<Record<string, number>>;
  readonly conceptNoHintsInARow: Readonly<Record<string, number>>;
  /** Today's streak, after folding in today's activity. */
  readonly streakCurrent: number;
  readonly warmupsCompleted: number;
  /** Scored exercises finished (any stars) after >= 2 wrong tries. */
  readonly comebackCount: number;
}

/** A subject's badge-condition delegate for the 3 `game-*` types (`undefined` for the engine's own 7). Method syntax:
 * bivariance lets a precise `SubjectRewards<F>` widen to `<unknown>` with no cast. */
export interface SubjectRewards<F> {
  facts(records: readonly GameRecord[]): F;
  conditionValue(condition: BadgeCondition, facts: F): number | undefined;
}

const TIER_NAMES: readonly BadgeTier[] = ['bronze', 'silver', 'gold'];

/** The number `condition.type` is measured against: engine types read `facts`; a subject's 3 go through
 * `subject.conditionValue` (`0` when unwired). */
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

export interface NewlyEarnedBadge {
  readonly badgeId: string;
  readonly tier?: BadgeTier;
}

/** `"<badgeId>:<tier>"` key, `tier` blank for an untiered badge — how `evaluateBadges` dedupes against `earned`. */
function earnedKey(badgeId: string, tier: BadgeTier | undefined): string {
  return `${badgeId}:${tier ?? ''}`;
}

/** Every threshold newly crossed and not yet in `earned` (badges are never lost). `subject`/`subjectFacts`
 * serve the 3 `game-*` types; omitted, they never earn. */
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

export function markSeen(badge: EarnedBadge, now: Date): EarnedBadge {
  if (badge.seen) return badge;
  return { ...badge, seen: true, updatedAt: now.toISOString() };
}
