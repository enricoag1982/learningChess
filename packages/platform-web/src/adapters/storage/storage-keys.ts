/** Every `LocalStore` record name this app writes; one source of truth so a repository and the
 * backup importer never drift to different strings for the same record. */
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
