// The math e2e kit: the platform's page flows bound to the math locale, plus a driver that plays any
// exercise from its kind's `solution()` through the kind's own e2e driver (one path for every kind).
import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { createE2ETexts } from '@learn/platform-web/e2e/i18n.ts';
import { createPages } from '@learn/platform-web/e2e/pages.ts';
import type {
  MathAction,
  MathContent,
  MathExerciseDef,
  MathLesson,
  MathSeriesGame,
} from '@learn/subject-math';
import { MATH_CHARACTERS, kindOf } from '@learn/subject-math';
import { solutionOf } from '@learn/subject-math/testing';
import { kindE2EOf } from '@learn/subject-math/web/kinds/e2e-registry.ts';
import { modeE2EOf } from '@learn/subject-math/web/modes/e2e-registry.ts';
// Node's ESM loader (specs run straight under Playwright, outside Vite) requires this attribute for
// a JSON import.
import rawContent from '@learn/subject-math/dist/content.json' with { type: 'json' };
import en from '@learn/subject-math/dist/locales/en.json' with { type: 'json' };

/** The math locale's texts, resolved as the app renders them (`lessons:add-within-5.title`, `math.erase`). */
export const { contentText, interpolate } = createE2ETexts({ en });

/** The shared page flows bound to the math app's title and locale. */
export const {
  completeFirstRun,
  dismissCelebrationIfShown,
  pickProfileFromPicker,
  startLessonToFirstGuided,
  openParentArea,
} = createPages({ appTitle: contentText('app.title'), texts: { contentText } });

// The content build validates this shape (invalid content fails `pnpm build`), so this is a type
// conversion, not a runtime check.
const content = rawContent as unknown as MathContent;

export function findLesson(id: string): MathLesson {
  const lesson = content.lessons.find((entry) => entry.id === id);
  if (!lesson) throw new Error(`math content is missing lesson "${id}"`);
  return lesson;
}

export function findMiniGame(id: string): MathSeriesGame {
  const game = content.minigames.find((entry) => entry.id === id);
  if (!game) throw new Error(`math content is missing mini-game "${id}"`);
  return game;
}

/** Escapes regex metacharacters so `text` can be embedded literally in a `RegExp` source. */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Accessible name of a lesson's Journey node for `status`: the lesson's title, or for a character
 * lesson its name plus a wildcarded topic word (only app UI code maps character to topic).
 */
export function journeyNodeName(lesson: MathLesson, status: 'current' | 'locked'): RegExp {
  const character = MATH_CHARACTERS[lesson.character];
  const name =
    character === undefined
      ? escapeRegExp(contentText(lesson.titleKey))
      : `${escapeRegExp(contentText(`characters:${lesson.character}.name`))} the .+`;
  const pattern = interpolate(contentText('journey:ui.node-name'), {
    name,
    status: escapeRegExp(contentText(`journey:ui.status-${status}`)),
  });
  return new RegExp(`^${pattern}$`);
}

/** Accessible name of the world boss's Journey node for `status`. */
export function worldBossNodeName(
  game: MathSeriesGame,
  status: 'available' | 'locked' | 'won',
): string {
  return interpolate(contentText('journey:ui.world-boss-name'), {
    title: contentText(game.titleKey),
    status: contentText(`journey:ui.boss-status-${status}`),
  });
}

/**
 * Folds `actions` over `def`'s own kind: computes each step purely (`kind.act`, the same call the
 * app's reducer makes) and drives the UI to reproduce it through the kind's e2e driver.
 */
async function runActions(
  page: Page,
  def: MathExerciseDef,
  actions: readonly MathAction[],
): Promise<void> {
  const kind = kindOf(def);
  const driver = kindE2EOf(def.type);
  let state = kind.init(def);
  for (const action of actions) {
    const before = state;
    const { state: next, outcome } = kind.act(before, action, null);
    await driver.perform(page, action, { def, before, outcome, text: contentText });
    state = next;
    // The problem card echoes what was typed; waiting for it keeps the next tap off a stale render.
    if (!next.solved && next.entry !== '') {
      const label = interpolate(contentText('math.entry-label'), { value: next.entry });
      await expect(page.getByRole('status', { name: label, exact: true })).toBeVisible();
    }
  }
}

/** Solves any exercise definition through the UI, leaving it on its success panel. */
export async function solveExercise(page: Page, def: MathExerciseDef): Promise<void> {
  await runActions(page, def, solutionOf(def).solution(def, null));
}

/** Solves one guided try or scored exercise, then advances past its success panel. */
export async function completeExercise(page: Page, def: MathExerciseDef): Promise<void> {
  await solveExercise(page, def);
  await page.getByRole('button', { name: /^Next/ }).click();
}

/** Plays a lesson from its first guided try to its Complete step: every guided try, then every exercise. */
export async function playLesson(page: Page, lesson: MathLesson): Promise<void> {
  for (const exercise of [...lesson.guided, ...lesson.exercises]) {
    await completeExercise(page, exercise);
  }
}

/** Plays a series mini-game round by round with the mode's own e2e driver, leaving its result showing. */
export async function playSeries(page: Page, game: MathSeriesGame): Promise<void> {
  await modeE2EOf(game.mode).play(page, game, { text: contentText, solve: solveExercise });
}
