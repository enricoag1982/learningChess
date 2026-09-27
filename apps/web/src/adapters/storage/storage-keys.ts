/**
 * Every `LocalStore` record name this app writes (`chess-kids:<name>`, `architecture.md` §11),
 * `parent-lock` apart — the one thing a restored/merged backup must never touch (`local-backup-
 * importer.ts`'s own doc). One source of truth so a repository and the importer can never drift
 * to different strings for the same record.
 */
export const STORAGE_KEYS = {
  profiles: 'profiles',
  settings: 'settings',
  lessonProgress: 'lesson-progress',
  attempts: 'attempts',
  minigameProgress: 'minigame-progress',
  conceptStats: 'concept-stats',
  gameRecords: 'game-records',
  earnedBadges: 'earned-badges',
  streaks: 'streaks',
  sessionLogs: 'session-logs',
  assessmentResults: 'assessment-results',
  unlocks: 'unlocks',
  parentLock: 'parent-lock',
} as const;
