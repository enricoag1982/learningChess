/**
 * Platform fixture builders (profile, progress, review stats, attempts) for tests.
 * `@learn/platform-core/testing` only (`package.json`'s `exports`) — never re-exported from
 * `index.ts`, so none of this reaches the app bundle. Each builder returns sensible defaults; pass
 * `overrides` to change just the fields a test cares about.
 */
import type { Profile } from '../domain/profile.ts';
import type { Attempt, LessonProgress, MiniGameProgress } from '../domain/progress.ts';
import type { ConceptStats } from '../domain/review.ts';

/** `LessonProgress` fixture: fresh progress for profile `profile-1` on lesson `rook`. */
export function makeProgress(overrides: Partial<LessonProgress> = {}): LessonProgress {
  return {
    id: 'lesson-progress-1',
    profileId: 'profile-1',
    lessonId: 'rook',
    bestStars: {},
    bossStars: 0,
    resumeStep: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/** `MiniGameProgress` fixture for profile `profile-1` on mini-game `hungry-rook`. */
export function makeMiniGameProgress(overrides: Partial<MiniGameProgress> = {}): MiniGameProgress {
  return {
    id: 'minigame-progress-1',
    profileId: 'profile-1',
    miniGameId: 'hungry-rook',
    bestStars: 3,
    plays: 1,
    wins: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/** `ConceptStats` fixture for profile `profile-1` on concept `rook-move`, no attempts yet. */
export function makeConceptStats(overrides: Partial<ConceptStats> = {}): ConceptStats {
  return {
    id: 'concept-stats-1',
    profileId: 'profile-1',
    conceptId: 'rook-move',
    recent: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/** `Attempt` fixture: a correct, 3-star, unhinted try at `rook-01` for profile `profile-1`. */
export function makeAttempt(overrides: Partial<Attempt> = {}): Attempt {
  return {
    id: 'attempt-1',
    profileId: 'profile-1',
    lessonId: 'rook',
    exerciseId: 'rook-01',
    conceptId: 'rook-move',
    scored: true,
    correct: true,
    stars: 3,
    hints: 0,
    errors: 0,
    moves: 1,
    durationMs: 1000,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/** `Profile` fixture: "Rex" the fox, account "local". */
export function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'p1',
    accountId: 'local',
    nickname: 'Rex',
    avatar: 'fox',
    locale: 'en',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}
