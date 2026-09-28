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
  type AssessmentScope,
  type AssessmentScore,
  type ConceptTask,
  type Lesson,
  type ParentUnlockTarget,
} from '@learn/platform-core';
import type { Route } from '@learn/platform-web/app/routes.ts';
import { backAndRefresh, type AppGet, type SliceCreator } from '../store.ts';

export interface LearnSlice {
  readonly stepIndex: number;

  /** Journey tap: opens an available/complete/mastered `lessonId` at its story (if done) or saved
   * step; a locked one is a no-op (Journey intercepts with "Finish … first"). */
  readonly startLesson: (lessonId: string) => Promise<void>;
  readonly goToStep: (index: number) => void;
  /** Lesson Close: back to Home/Journey (one level below on the stack); a Today lesson abandons
   * the session instead (`leaveToday`, domain-model.md §3.3 "leave any time"). */
  readonly exitLesson: () => void;
  /** The lesson-complete screen's "Continue": a Today-session lesson advances to the session's next
   * activity (`advanceToday`); otherwise identical to `exitLesson`. */
  readonly completeLessonActivity: () => Promise<void>;
  /** Journey locked-tap sheet "Yes, test me!" for a locked lesson (domain-model.md §3.2): plans a
   * lesson test-out run (`planTestOutLesson`) and opens the runner (screen `assessment`). */
  readonly startTestOutLesson: (lessonId: string, worldId: string) => void;
  /** Same, for a locked world (`planTestOutWorld`): all its lessons at once. */
  readonly startTestOutWorld: (worldId: string) => void;
  /** Assessment runner's `onDone`: scores + records the pass, unlocking the scope; the runner
   * shows the result itself, then calls `exitAssessment`. */
  readonly submitAssessmentRun: (results: readonly boolean[]) => Promise<AssessmentScore>;
  /** Leaves the assessment screen (Close, or the result screen's Continue) back to the Journey. */
  readonly exitAssessment: () => void;
  /** Placement offer screen "No, start at World 1": straight to Home, nothing tested. */
  readonly declinePlacement: () => void;
  /** Placement offer screen "Yes": plans the whole placement test (`planPlacement`) and opens the
   * first Basics world's run (screen `placement`); straight to Home if there is nothing to test. */
  readonly acceptPlacement: () => void;
  /** One placement world's `onDone`: scores + records the pass; the screen then calls
   * `advancePlacementWorld` (more worlds left) or `finishPlacement`. */
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
  /** Opens a mini-game session from Play or a Journey world-boss node, pushed on top so
   * `exitMiniGame`'s `back()` returns there unaided. Subject-free: any mini-game mode. */
  readonly startMiniGame: (miniGameId: string) => void;
  /** Leaves the mini-game session for wherever it opened from; a Today one abandons the whole
   * session instead (`leaveToday`). */
  readonly exitMiniGame: () => void;
}

/** Enters `lessonId` via `enter` (`navigate` to open fresh, `replace` for a Today session moving
 * from one activity to the next). Shared by `startLesson` and `enterTodayActivity`. */
export async function enterLesson(
  get: AppGet,
  lessonId: string,
  options?: { readonly today?: true; readonly enter?: (route: Route) => Promise<void> },
): Promise<void> {
  const { profile, journey, services } = get();
  if (!profile) return;
  const lesson: Lesson | undefined = services.deps.content.lesson(lessonId);
  if (!lesson) return;
  if (journey?.statuses.get(lessonId) === 'locked') return;
  const saved = await getLessonProgress(services.deps, profile.id, lessonId);
  const status = lessonStatus(lesson, saved);
  const startStep = status === 'complete' || status === 'mastered' ? 0 : saved.resumeStep;
  const enter = options?.enter ?? get().navigate;
  await enter({ name: 'lesson', lessonId, startStep, ...(options?.today ? { today: true } : {}) });
}

/** Records a test-out/placement pass for the active profile; a no-op without one. Shared by
 * `submitAssessmentRun` and `submitPlacementWorldRun`. */
async function recordScore(
  get: AppGet,
  kind: 'test-out' | 'placement',
  scope: AssessmentScope,
  results: readonly boolean[],
  score: AssessmentScore,
): Promise<void> {
  const { profile, services } = get();
  if (!profile) return;
  await submitAssessment(services.deps, { profileId: profile.id, kind, scope, results, score });
}

export const createLearnSlice: SliceCreator<LearnSlice> = (set, get) => {
  return {
    stepIndex: 0,

    startLesson: (lessonId) => enterLesson(get, lessonId),
    goToStep: (index) => {
      set({ stepIndex: index });
    },

    exitLesson() {
      const { stack } = get();
      const top = stack[stack.length - 1];
      set({ stepIndex: 0 });
      if (top?.name === 'lesson' && top.today) {
        get().leaveToday();
      } else {
        void get().back(stack[stack.length - 2]?.name === 'home' ? 'home' : undefined, {
          gate: stack[stack.length - 2]?.name === 'home',
        });
      }
      void get().refreshProgress();
    },

    async completeLessonActivity() {
      const { stack } = get();
      const top = stack[stack.length - 1];
      set({ stepIndex: 0 });
      if (top?.name === 'lesson' && top.today) {
        await get().advanceToday();
      } else {
        const landsOnHome = stack[stack.length - 2]?.name === 'home';
        await get().back(landsOnHome ? 'home' : undefined, { gate: landsOnHome });
      }
      void get().refreshProgress();
    },

    startTestOutLesson(lessonId: string, worldId: string) {
      const { journey, services } = get();
      const lesson = journey?.lessons.find((entry) => entry.id === lessonId);
      if (!lesson) return;
      const tasks = planTestOutLesson(lesson, services.deps.random);
      if (tasks.length === 0) return;
      void get().navigate({
        name: 'assessment',
        scope: { type: 'lesson', lessonId, worldId },
        tasks,
      });
    },

    startTestOutWorld(worldId: string) {
      const { journey, services } = get();
      if (!journey) return;
      const world = journey.worlds.find((entry) => entry.world.id === worldId)?.world;
      if (!world) return;
      const tasks = planTestOutWorld(world, journey.lessons, services.deps.random);
      if (tasks.length === 0) return;
      void get().navigate({ name: 'assessment', scope: { type: 'world', worldId }, tasks });
    },

    async submitAssessmentRun(results: readonly boolean[]) {
      const score = scoreTestOut(results);
      const top = get().stack[get().stack.length - 1];
      if (top?.name === 'assessment') {
        await recordScore(get, 'test-out', top.scope, results, score);
      }
      return score;
    },

    exitAssessment: backAndRefresh(get),

    declinePlacement: () => void get().back('home', { gate: true }),

    acceptPlacement() {
      const { journey, services } = get();
      if (!journey) {
        void get().back();
        return;
      }
      const plan = planPlacement(journey.catalog, journey.lessons, services.deps.random);
      if (plan.length === 0) {
        void get().back();
        return;
      }
      void get().replace({ name: 'placement', plan, index: 0 });
    },

    async submitPlacementWorldRun(worldId: string, results: readonly boolean[]) {
      const score = scorePlacementWorld(results);
      await recordScore(get, 'placement', { type: 'world', worldId }, results, score);
      return score;
    },

    advancePlacementWorld() {
      const top = get().stack[get().stack.length - 1];
      if (top?.name !== 'placement') return;
      void get().replace({ name: 'placement', plan: top.plan, index: top.index + 1 });
    },

    finishPlacement: backAndRefresh(get, 'home', { gate: true }),

    async parentUnlockTarget(profileId: string, target) {
      const { services } = get();
      await parentUnlock(services.deps, profileId, target);
    },

    async startPracticeWarmUp() {
      const { profile, services } = get();
      if (!profile) return;
      const tasks: readonly ConceptTask[] = await loadWarmUp(services.deps, profile.id);
      if (tasks.length === 0) return;
      await get().navigate({ name: 'practice-run', conceptId: null, tasks });
    },

    async startPracticeTopic(conceptId: string) {
      const { profile, services } = get();
      if (!profile) return;
      const tasks = await loadPracticeTasks(services.deps, profile.id, conceptId);
      await get().navigate({ name: 'practice-run', conceptId, tasks });
    },

    exitPracticeRun: backAndRefresh(get),

    startMiniGame: (miniGameId) => void get().navigate({ name: 'minigame', miniGameId }),

    exitMiniGame() {
      const top = get().stack[get().stack.length - 1];
      if (top?.name === 'minigame' && top.today) {
        get().leaveToday();
      } else {
        void get().back();
      }
      void get().refreshProgress();
    },
  };
};
