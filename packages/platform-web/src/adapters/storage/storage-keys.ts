/** Every `LocalStore` record name this app writes; one source of truth for repositories and the backup importer. */
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
