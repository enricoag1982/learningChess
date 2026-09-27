import type {
  AssessmentScope,
  AssessmentScore,
  ConceptTask,
  Lesson,
  ParentUnlockTarget,
  PlacementWorldPlan,
} from '@chess-kids/core';
import {
  getLessonProgress,
  lessonStatus,
  loadPracticeTasks,
  loadWarmUp,
  parentUnlock,
  planPlacement,
  planTestOutLesson,
  planTestOutWorld,
  scorePlacementWorld,
  scoreTestOut,
  submitAssessment,
} from '@chess-kids/core';
import type { AppGet, AppSet } from '../store.ts';
import { gated } from './time.ts';
import { goHomeGated } from './nav.ts';

/** Where the current lesson was opened from: decides where "Continue"/Close returns to.
 * `today`: opened as a Today session's lesson (or world-boss) activity — see `startToday`. */
export type LessonOrigin = 'home' | 'journey' | 'today';

export interface LearnSlice {
  readonly lessonId: string | null;
  readonly stepIndex: number;
  /** Where the open lesson was entered from; decides where Close/Continue returns to. */
  readonly lessonOrigin: LessonOrigin;
  /** The test-out run in progress (screen `assessment`, M4.5: domain-model.md §3.2); `null` outside
   * one. Its own runner records each task locally and scores the whole run once done — see
   * `submitAssessmentRun`. */
  readonly assessmentRun: {
    readonly scope: AssessmentScope;
    readonly tasks: readonly ConceptTask[];
  } | null;
  /** The placement test's full plan (one run per Basics world, in order), loaded once by
   * `acceptPlacement`; `[]` outside a placement run (screen `placement`). */
  readonly placementPlan: readonly PlacementWorldPlan[];
  /** Index into `placementPlan` of the world currently running. */
  readonly placementIndex: number;
  /** The Practice topic run's concept (screen `practice-run`); `null` outside one. */
  readonly practiceConceptId: string | null;
  readonly practiceTasks: readonly ConceptTask[];

  /**
   * Journey tap: opens `lessonId` (available / complete / mastered only — a no-op for a locked
   * one, which the Journey screen intercepts with a spoken "Finish … first" line instead). A
   * complete/mastered lesson restarts at the story; otherwise resumes at its saved step.
   */
  readonly startLesson: (lessonId: string) => Promise<void>;
  readonly goToStep: (index: number) => void;
  /**
   * Leaves the lesson screen (top-bar Close) for Home or the Journey, whichever it was opened
   * from; a Today-session lesson (`lessonOrigin: 'today'`) abandons the whole session instead
   * (`leaveToday` — "the kid can leave any time", domain-model.md §3.3).
   */
  readonly exitLesson: () => void;
  /**
   * The lesson-complete screen's "Continue": a Today-session lesson advances to the session's next
   * activity (`advanceToday`); otherwise identical to `exitLesson`.
   */
  readonly completeLessonActivity: () => Promise<void>;
  /**
   * Journey locked-tap sheet "Yes, test me!" for a locked lesson (domain-model.md §3.2): plans a
   * lesson test-out run (`planTestOutLesson`) and opens the runner (screen `assessment`).
   */
  readonly startTestOutLesson: (lessonId: string, worldId: string) => void;
  /** Same, for a locked world (`planTestOutWorld`): all its lessons at once. */
  readonly startTestOutWorld: (worldId: string) => void;
  /**
   * The assessment runner's `onDone`: scores the run (`scoreTestOut`) and applies a pass
   * (`submitAssessment`) — masters every lesson in scope, unlocks it. Does not change screen; the
   * runner shows the pass/fail result itself, then calls `exitAssessment`.
   */
  readonly submitAssessmentRun: (results: readonly boolean[]) => Promise<AssessmentScore>;
  /** Leaves the assessment screen (Close, or the result screen's Continue) back to the Journey. */
  readonly exitAssessment: () => void;
  /** Placement offer screen "No, start at World 1": straight to Home, nothing tested. */
  readonly declinePlacement: () => void;
  /** Placement offer screen "Yes": plans the whole placement test (`planPlacement`) and opens the
   * first Basics world's run (screen `placement`); straight to Home if there is nothing to test. */
  readonly acceptPlacement: () => void;
  /**
   * One placement world's `onDone`: scores it (`scorePlacementWorld`) and applies a pass
   * (`submitAssessment`) — same effect as a world test-out, `masteredVia: 'placement'`. Does not
   * advance `placementIndex` itself; the screen reads the outcome and calls `advancePlacementWorld`
   * (pass, more worlds left) or `finishPlacement` (fail, or nothing left to test).
   */
  readonly submitPlacementWorldRun: (
    worldId: string,
    results: readonly boolean[],
  ) => Promise<AssessmentScore>;
  /** Moves the placement run to its next Basics world. */
  readonly advancePlacementWorld: () => void;
  /** Ends the placement run (all worlds done, a world failed, or the kid closed it early — "can be
   * skipped any time, keeps what passed") and returns Home, refreshing progress. */
  readonly finishPlacement: () => void;
  /** Parent area "Unlock" list: unlocks one lesson or world directly for `profileId`
   * (domain-model.md §3.2 "Parent unlock", `masteredVia: 'parent'`). */
  readonly parentUnlockTarget: (profileId: string, target: ParentUnlockTarget) => Promise<void>;
  /** Practice's "Daily warm-up" card: loads today's warm-up tasks and opens the task-run screen
   * (a no-op if nothing is due — the card is disabled by then, but this guards a stale click). */
  readonly startPracticeWarmUp: () => Promise<void>;
  /** Practice topic tap: loads that concept's review tasks and opens the task-run screen. */
  readonly startPracticeTopic: (conceptId: string) => Promise<void>;
  /** Leaves the Practice task run back to the topic list, refreshing progress. */
  readonly exitPracticeRun: () => void;
}

/** Enters `lessonId`, remembering `origin` for `exitLesson`. Shared by `startLesson`/`enterTodayActivity`. */
export async function enterLesson(
  set: AppSet,
  get: AppGet,
  lessonId: string,
  origin: LessonOrigin,
): Promise<void> {
  const { profile, journey, services } = get();
  if (!profile) return;
  const lesson: Lesson | undefined = services.deps.content.lesson(lessonId);
  if (!lesson) return;
  if (journey?.statuses.get(lessonId) === 'locked') return;
  const saved = await getLessonProgress(services.deps, profile.id, lessonId);
  const status = lessonStatus(lesson, saved);
  const startIndex = status === 'complete' || status === 'mastered' ? 0 : saved.resumeStep;
  await gated(set, get, () => {
    set({ screen: 'lesson', lessonId, stepIndex: startIndex, lessonOrigin: origin });
  });
}

export function createLearnSlice(set: AppSet, get: AppGet): LearnSlice {
  return {
    lessonId: null,
    stepIndex: 0,
    lessonOrigin: 'home',
    assessmentRun: null,
    placementPlan: [],
    placementIndex: 0,
    practiceConceptId: null,
    practiceTasks: [],

    async startLesson(lessonId: string) {
      await enterLesson(set, get, lessonId, 'journey');
    },

    goToStep(index: number) {
      set({ stepIndex: index });
    },

    exitLesson() {
      const origin = get().lessonOrigin;
      set({ lessonId: null, stepIndex: 0 });
      if (origin === 'today') {
        get().leaveToday();
        return;
      }
      if (origin === 'journey') {
        set({ screen: 'journey' });
      } else {
        void goHomeGated(set, get);
      }
      void get().refreshProgress();
    },

    async completeLessonActivity() {
      const origin = get().lessonOrigin;
      set({ lessonId: null, stepIndex: 0 });
      if (origin === 'today') {
        await get().advanceToday();
        return;
      }
      if (origin === 'journey') {
        set({ screen: 'journey' });
      } else {
        await goHomeGated(set, get);
      }
      void get().refreshProgress();
    },

    startTestOutLesson(lessonId: string, worldId: string) {
      const { journey, services } = get();
      const lesson = journey?.lessons.find((entry) => entry.id === lessonId);
      if (!lesson) return;
      const tasks = planTestOutLesson(lesson, services.deps.random);
      if (tasks.length === 0) return;
      set({
        assessmentRun: { scope: { type: 'lesson', lessonId, worldId }, tasks },
        screen: 'assessment',
      });
    },

    startTestOutWorld(worldId: string) {
      const { journey, services } = get();
      if (!journey) return;
      const world = journey.worlds.find((entry) => entry.world.id === worldId)?.world;
      if (!world) return;
      const tasks = planTestOutWorld(world, journey.lessons, services.deps.random);
      if (tasks.length === 0) return;
      set({ assessmentRun: { scope: { type: 'world', worldId }, tasks }, screen: 'assessment' });
    },

    async submitAssessmentRun(results: readonly boolean[]) {
      const { profile, assessmentRun, services } = get();
      const score = scoreTestOut(results);
      if (!profile || !assessmentRun) return score;
      await submitAssessment(services.deps, {
        profileId: profile.id,
        kind: 'test-out',
        scope: assessmentRun.scope,
        results,
        score,
      });
      return score;
    },

    exitAssessment() {
      set({ assessmentRun: null, screen: 'journey' });
      void get().refreshProgress();
    },

    declinePlacement() {
      void goHomeGated(set, get);
    },

    acceptPlacement() {
      const { journey, services } = get();
      if (!journey) {
        set({ screen: 'home' });
        return;
      }
      const plan = planPlacement(journey.catalog, journey.lessons, services.deps.random);
      if (plan.length === 0) {
        set({ screen: 'home' });
        return;
      }
      set({ placementPlan: plan, placementIndex: 0, screen: 'placement' });
    },

    async submitPlacementWorldRun(worldId: string, results: readonly boolean[]) {
      const { profile, services } = get();
      const score = scorePlacementWorld(results);
      if (!profile) return score;
      await submitAssessment(services.deps, {
        profileId: profile.id,
        kind: 'placement',
        scope: { type: 'world', worldId },
        results,
        score,
      });
      return score;
    },

    advancePlacementWorld() {
      set((state) => ({ placementIndex: state.placementIndex + 1 }));
    },

    finishPlacement() {
      set({ placementPlan: [], placementIndex: 0 });
      void goHomeGated(set, get);
      void get().refreshProgress();
    },

    async parentUnlockTarget(profileId: string, target) {
      const { services } = get();
      await parentUnlock(services.deps, profileId, target);
    },

    async startPracticeWarmUp() {
      const { profile, services } = get();
      if (!profile) return;
      const tasks = await loadWarmUp(services.deps, profile.id);
      if (tasks.length === 0) return;
      await gated(set, get, () => {
        set({ practiceConceptId: null, practiceTasks: tasks, screen: 'practice-run' });
      });
    },

    async startPracticeTopic(conceptId: string) {
      const { profile, services } = get();
      if (!profile) return;
      const tasks = await loadPracticeTasks(services.deps, profile.id, conceptId);
      await gated(set, get, () => {
        set({ practiceConceptId: conceptId, practiceTasks: tasks, screen: 'practice-run' });
      });
    },

    exitPracticeRun() {
      set({ screen: 'practice', practiceConceptId: null, practiceTasks: [] });
      void get().refreshProgress();
    },
  };
}
