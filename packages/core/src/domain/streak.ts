import type { StoredRecord } from './profile.ts';

/** One profile's daily-play streak (domain-model.md §2, rewards.md §1 "Forgiving streaks"). */
export interface Streak extends StoredRecord {
  readonly profileId: string;
  readonly current: number;
  readonly best: number;
  /** Local calendar day (`YYYY-MM-DD`, device time zone) the streak last counted. */
  readonly lastDay?: string;
  /** Free skips already used in `lastDay`'s ISO week (1 per week, rewards.md §1). */
  readonly skipsUsedThisWeek: number;
}

/** Fresh, unsaved streak for a profile with no counted day yet. */
export function newStreak(id: string, profileId: string, now: Date): Streak {
  const nowIso = now.toISOString();
  return {
    id,
    profileId,
    current: 0,
    best: 0,
    skipsUsedThisWeek: 0,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

/** `date`'s local calendar day (device time zone), `YYYY-MM-DD`. */
export function localDayString(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Whole calendar days between two `YYYY-MM-DD` strings (`b - a`), ignoring time zone (noon UTC avoids DST edges). */
function daysBetween(a: string, b: string): number {
  const toNoonUtc = (day: string): number => new Date(`${day}T12:00:00Z`).getTime();
  return Math.round((toNoonUtc(b) - toNoonUtc(a)) / (24 * 60 * 60 * 1000));
}

/** ISO-8601 week key (`YYYY-W<n>`) for a `YYYY-MM-DD` day string — the Monday-start week rewards.md §1 counts skips against. */
export function isoWeekKey(day: string): string {
  const [year, month, date] = day.split('-').map(Number);
  const asDate = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, date ?? 1));
  // Shift to the Thursday of this ISO week: the ISO week's year is always that Thursday's year.
  const dayNumber = (asDate.getUTCDay() + 6) % 7; // Monday = 0 .. Sunday = 6
  asDate.setUTCDate(asDate.getUTCDate() - dayNumber + 3);
  const isoYear = asDate.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const week = Math.ceil(((asDate.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${String(isoYear)}-W${String(week)}`;
}

/**
 * Folds one day's activity into `streak` (rewards.md §1 "Forgiving streaks"): the same day is a
 * no-op; the very next day extends the streak; a single missed day is bridged by one free skip per
 * ISO week (of the missed day) — spending it if available, else the streak restarts at 1 silently.
 * Anything wider than a bridged gap also restarts at 1. `best` only ever grows.
 */
export function recordActivityDay(streak: Streak, day: string, now: Date): Streak {
  if (streak.lastDay === day) {
    return streak;
  }

  const nowIso = now.toISOString();

  if (streak.lastDay === undefined) {
    return {
      ...streak,
      current: 1,
      best: Math.max(streak.best, 1),
      lastDay: day,
      updatedAt: nowIso,
    };
  }

  const gap = daysBetween(streak.lastDay, day);

  if (gap === 1) {
    const sameWeek = isoWeekKey(streak.lastDay) === isoWeekKey(day);
    const current = streak.current + 1;
    return {
      ...streak,
      current,
      best: Math.max(streak.best, current),
      lastDay: day,
      skipsUsedThisWeek: sameWeek ? streak.skipsUsedThisWeek : 0,
      updatedAt: nowIso,
    };
  }

  if (gap === 2) {
    // The skip is charged against the *reporting* day's ISO week (when the gap is noticed), not
    // the missed day's — simplest to reason about, and the two are the same week except right at
    // a week boundary.
    const skipWeek = isoWeekKey(day);
    const skipsUsedThisWeek =
      isoWeekKey(streak.lastDay) === skipWeek ? streak.skipsUsedThisWeek : 0;
    if (skipsUsedThisWeek < 1) {
      const current = streak.current + 1;
      return {
        ...streak,
        current,
        best: Math.max(streak.best, current),
        lastDay: day,
        skipsUsedThisWeek: skipsUsedThisWeek + 1,
        updatedAt: nowIso,
      };
    }
  }

  // Broken streak (gap > 2, or gap === 2 with no skip left): restarts at 1, silently.
  return {
    ...streak,
    current: 1,
    best: Math.max(streak.best, 1),
    lastDay: day,
    skipsUsedThisWeek:
      isoWeekKey(day) === isoWeekKey(streak.lastDay) ? streak.skipsUsedThisWeek : 0,
    updatedAt: nowIso,
  };
}
