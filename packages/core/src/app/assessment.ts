import type { AssessmentKind, AssessmentScope, AssessmentScore } from '../domain/assessment.ts';
import { newAssessmentResult, newUnlock } from '../domain/assessment.ts';
import type { TracksCatalog } from '../domain/journey.ts';
import { worldLessons } from '../domain/journey.ts';
import type { Lesson } from '../domain/lesson.ts';
import { recordExerciseStars } from '../domain/progress.ts';
import type { MasteredVia } from '../domain/progress.ts';
import { enterReview } from '../domain/review.ts';
import type { AssessmentRepository } from './ports.ts';
import { checkRewards } from './rewards.ts';
import { getConceptStats, getLessonProgress } from './use-cases.ts';
import type { AppDeps } from './use-cases.ts';

/** `deps.assessment`, or a clear error if this `AppDeps` has not wired it up. */
function requireAssessment(deps: AppDeps): AssessmentRepository {
  if (deps.assessment === undefined) {
    throw new Error('AppDeps.assessment is not wired up');
  }
  return deps.assessment;
}

/** `content.catalog()`, or a clear error if this `ContentSource` has not wired it up yet. */
function requireCatalog(deps: AppDeps): TracksCatalog {
  const catalog = deps.content.catalog?.();
  if (catalog === undefined) {
    throw new Error('ContentSource.catalog() is not implemented');
  }
  return catalog;
}

function findWorld(catalog: TracksCatalog, worldId: string) {
  for (const track of catalog.tracks) {
    const found = track.worlds.find((world) => world.id === worldId);
    if (found !== undefined) return found;
  }
  return undefined;
}

/**
 * Every lesson/world id currently unlocked out of the normal Journey order for this profile
 * (domain-model.md §3.2): a passed test-out/placement, or a parent unlock. Feeds `journey.ts`'s
 * `unlocked` parameter — see `loadJourney` (`app/journey.ts`) and `planTodaySession`
 * (`app/session.ts`). `undefined` without `deps.assessment` wired (every pre-M4.5 test fixture).
 */
export async function loadUnlocked(
  deps: AppDeps,
  profileId: string,
): Promise<ReadonlySet<string> | undefined> {
  if (deps.assessment === undefined) return undefined;
  const unlocks = await deps.assessment.listUnlocks(profileId);
  return new Set(unlocks.map((unlock) => unlock.targetId));
}

/** Every lesson in `scope` (one for a lesson-scope run, every lesson of the world for a world one). */
function lessonsInScope(deps: AppDeps, catalog: TracksCatalog, scope: AssessmentScope): Lesson[] {
  if (scope.type === 'lesson') {
    const lesson = deps.content.lesson(scope.lessonId);
    return lesson === undefined ? [] : [lesson];
  }
  const world = findWorld(catalog, scope.worldId);
  return world === undefined ? [] : [...worldLessons(world, deps.content.lessons())];
}

/** Input to {@link submitAssessment}. */
export interface SubmitAssessmentInput {
  readonly profileId: string;
  readonly kind: AssessmentKind;
  readonly scope: AssessmentScope;
  /** First-try correct/incorrect per task, in the order the tasks were shown. */
  readonly results: readonly boolean[];
  readonly score: AssessmentScore;
}

/**
 * Records one taken assessment run (domain-model.md §3.2): always saves the `AssessmentResult` (for
 * the parent report). A pass also applies its effect: every lesson in `scope` gets
 * `masteredVia: kind`, every one of its exercises floored to >= 1 best star (never lowering an
 * existing higher one), its concept enters review (box 1, due tomorrow — a no-op if already in
 * review), and the scope's own id (the lesson id, or the world id) joins the unlocked set. Then
 * `checkRewards` runs once, so a newly-mastered world's milestone badge fires right away (the lead's
 * own note: a test-out/placement pass must also run the rewards check). A fail changes nothing else
 * (domain-model.md §3.2 "Fail: no penalty, nothing lost").
 */
export async function submitAssessment(
  deps: AppDeps,
  input: SubmitAssessmentInput,
): Promise<AssessmentScore> {
  const { profileId, kind, scope, score } = input;
  const now = deps.clock.now();
  const assessment = requireAssessment(deps);

  await assessment.addAssessmentResult(
    newAssessmentResult(deps.ids.next(), profileId, kind, scope, score, now),
  );

  if (!score.passed) {
    return score;
  }

  const catalog = requireCatalog(deps);
  const via: MasteredVia = kind;
  for (const lesson of lessonsInScope(deps, catalog, scope)) {
    let progress = await getLessonProgress(deps, profileId, lesson.id);
    progress = { ...progress, masteredVia: via, updatedAt: now.toISOString() };
    for (const exercise of lesson.exercises) {
      progress = recordExerciseStars(progress, exercise.id, 1, lesson, now);
    }
    await deps.progress.saveLesson(progress);

    const stats = await getConceptStats(deps, profileId, lesson.concept);
    await deps.progress.saveConceptStats(enterReview(stats, now, false));
  }

  const targetType = scope.type;
  const targetId = scope.type === 'lesson' ? scope.lessonId : scope.worldId;
  await assessment.addUnlock(
    newUnlock(deps.ids.next(), profileId, targetType, targetId, kind, now),
  );

  await checkRewards(deps, profileId);

  return score;
}

/** What a parent unlocks directly (app-structure.md §11, domain-model.md §3.2 "Parent unlock"). */
export type ParentUnlockTarget =
  | { readonly type: 'lesson'; readonly lessonId: string }
  | { readonly type: 'world'; readonly worldId: string };

/**
 * Parent area "unlock a lesson/world directly": every lesson in `target` gets
 * `masteredVia: 'parent'` (no star floor — this is an admin override, not a passed check; the
 * lesson mastery it grants owes nothing to `bestStars`) and the target's own id joins the unlocked
 * set. Also runs `checkRewards`, same reasoning as a test-out/placement pass.
 */
export async function parentUnlock(
  deps: AppDeps,
  profileId: string,
  target: ParentUnlockTarget,
): Promise<void> {
  const now = deps.clock.now();
  const assessment = requireAssessment(deps);
  const catalog = requireCatalog(deps);
  const scope: AssessmentScope =
    target.type === 'lesson'
      ? {
          type: 'lesson',
          lessonId: target.lessonId,
          worldId: deps.content.lesson(target.lessonId)?.world ?? '',
        }
      : { type: 'world', worldId: target.worldId };

  for (const lesson of lessonsInScope(deps, catalog, scope)) {
    const progress = await getLessonProgress(deps, profileId, lesson.id);
    await deps.progress.saveLesson({
      ...progress,
      masteredVia: 'parent',
      updatedAt: now.toISOString(),
    });
  }

  const targetId = target.type === 'lesson' ? target.lessonId : target.worldId;
  await assessment.addUnlock(
    newUnlock(deps.ids.next(), profileId, target.type, targetId, 'parent', now),
  );

  await checkRewards(deps, profileId);
}
