// A tiny non-chess subject (multiple-choice "answer" exercises) and scratch-directory content
// builders: what the platform's own loader tests run on, so none of them imports a real subject.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { ExerciseDefBase, MiniGameBase } from '@learn/platform-core';
import { stringify } from 'yaml';
import { z } from 'zod';
import { ContentError, loadLocales } from '../load.ts';
import { loadContent } from '../lesson-load.ts';
import { createExerciseSchema } from '../lesson-schema.ts';
import type { ExerciseKindContent } from '../kinds/kind-content.ts';
import { miniGameCommonFields } from '../modes/common.ts';
import type { MiniGameModeContent } from '../modes/mode-content.ts';
import { exerciseBaseFields, textRefSchema } from '../schema.ts';
import type { StimulusContent, SubjectContent } from '../subject.ts';

/* ---------------------------------------------------------------------- the subject -------- */

interface AnswerDef extends ExerciseDefBase {
  readonly type: 'answer';
  readonly options: readonly string[];
  readonly correct: number;
  readonly prompt?: string;
}

interface ReadDef extends ExerciseDefBase {
  readonly type: 'read';
  readonly prompt?: string;
}

const answerSchema = z
  .object({
    ...exerciseBaseFields,
    type: z.literal('answer'),
    prompt: z.string().optional(),
    options: z.array(textRefSchema).min(2),
    correct: z.number().int().nonnegative(),
  })
  .strict();

/** Pick one option (each a text key); `correct` indexes it. */
const answer: ExerciseKindContent<AnswerDef, typeof answerSchema> = {
  type: 'answer',
  schema: answerSchema,
  compile: (raw, ctx) =>
    ctx.build<AnswerDef>({ type: 'answer', options: raw.options, correct: raw.correct }),
  verify(def, where, issues) {
    if (def.correct >= def.options.length) {
      issues.push(`${where}: correct ${String(def.correct)} is not an option`);
    }
  },
  textKeys: (def) =>
    def.options.map((key, index) => ({ key: `lessons:${key}`, label: `option ${String(index)}` })),
};

const readSchema = z
  .object({ ...exerciseBaseFields, type: z.literal('read'), prompt: z.string().optional() })
  .strict();

/** Nothing to answer, so the stimulus check does not apply to it. */
const read: ExerciseKindContent<ReadDef, typeof readSchema> = {
  type: 'read',
  schema: readSchema,
  compile: (_raw, ctx) => ctx.build<ReadDef>({ type: 'read' }),
  needsKidPiece: () => false,
};

/** Both kinds, by `type`. */
export const fixtureKinds = { answer, read } as const;

/** The stimulus: an optional `prompt` (head field); a blank one is an issue. */
const stimulus: StimulusContent = {
  compile: (raw) => ({
    head: 'prompt' in raw && typeof raw.prompt === 'string' ? { prompt: raw.prompt } : {},
    tail: {},
  }),
  check(def, at) {
    if ('prompt' in def && typeof def.prompt === 'string' && def.prompt.trim() === '') {
      at.issues.push(`${at.where}: blank prompt`);
    }
  },
};

interface StaticGame extends MiniGameBase {
  readonly mode: 'static';
  readonly par: number;
}

const staticSchema = z
  .object({
    ...miniGameCommonFields,
    mode: z.literal('static').optional(),
    par: z.number().int().positive(),
  })
  .strict();

/** The default mode (`mode` absent): one number and no exercises of its own. */
const staticMode: MiniGameModeContent<StaticGame, typeof staticSchema> = {
  mode: 'static',
  schema: staticSchema,
  compile: (raw) => ({
    mode: 'static',
    id: raw.id,
    concept: raw.concept,
    titleKey: `lessons:${raw.title ?? `${raw.id}.title`}`,
    goalKey: `lessons:${raw.goal ?? `${raw.id}.goal`}`,
    unlockAfter: raw.unlockAfter,
    par: raw.par,
  }),
  verify: () => undefined,
};

interface RoundsGame extends MiniGameBase {
  readonly mode: 'rounds';
  readonly rounds: readonly ExerciseDefBase[];
}

const roundsSchema = z
  .object({
    ...miniGameCommonFields,
    mode: z.literal('rounds'),
    rounds: z.array(createExerciseSchema(fixtureKinds, stimulus)).min(1),
  })
  .strict();

/** A fixed list of exercises of any kind, compiled and verified like a lesson's own. */
const roundsMode: MiniGameModeContent<RoundsGame, typeof roundsSchema> = {
  mode: 'rounds',
  schema: roundsSchema,
  compile(raw, ctx) {
    const rounds = ctx.exercises('rounds', raw.rounds, raw.concept);
    return rounds === null
      ? null
      : {
          mode: 'rounds',
          id: raw.id,
          concept: raw.concept,
          titleKey: `lessons:${raw.title ?? `${raw.id}.title`}`,
          goalKey: `lessons:${raw.goal ?? `${raw.id}.goal`}`,
          unlockAfter: raw.unlockAfter,
          rounds,
        };
  },
  verify(game, where, ctx) {
    for (const [index, round] of game.rounds.entries()) {
      const roundWhere = `${where}: rounds[${String(index)}]`;
      ctx.claimId(round.id, roundWhere);
      ctx.checkExercise(round, roundWhere);
    }
  },
  exercises: (game) => game.rounds,
};

/** The whole subject; `extraOutputs` reports the root it was built from. */
export const fixtureSubject: SubjectContent = {
  kinds: fixtureKinds,
  modes: { static: staticMode, rounds: roundsMode },
  stimulus,
  demo: {
    schema: z.object({ text: textRefSchema.optional(), label: z.string() }).strict(),
    compile: (_raw, textKey) => ({ textKey }),
  },
  badges: { fields: {}, validate: () => undefined },
  characters: { char1: { topicKey: 'topic.char1' } },
  extraOutputs: { 'extra.json': (root) => ({ root }) },
  voiceTemplates: () => undefined,
};

/* ------------------------------------------------------------------ scratch directory ------ */

/** The current test's scratch content directory (live binding: set fresh by `fixturesBeforeEach`). */
export let dir = '';

export function fixturesBeforeEach(): void {
  dir = mkdtempSync(join(tmpdir(), 'fixture-content-'));
  mkdirSync(join(dir, 'minigames'), { recursive: true });
}

export function fixturesAfterEach(): void {
  rmSync(dir, { recursive: true, force: true });
}

export function write(relPath: string, content: string): void {
  const filePath = join(dir, relPath);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, 'utf8');
}

/** Two-option answer: option 1 is right. */
export function validExercise(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'demo-01',
    type: 'answer',
    text: 'demo-01',
    options: ['opt-a', 'opt-b'],
    correct: 1,
    ...overrides,
  };
}

export function validLesson(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'demo-lesson',
    world: 'w1',
    order: 1,
    concept: 'c1',
    character: 'char1',
    title: 'demo-lesson.title',
    story: 'demo-lesson.story',
    demo: { text: 'demo-demo', label: 'Demo' },
    guided: [],
    exercises: [validExercise()],
    ...overrides,
  };
}

export function validMiniGame(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'mg1',
    concept: 'c1',
    unlockAfter: 'demo-lesson',
    title: 'mg1.title',
    goal: 'mg1.goal',
    par: 3,
    ...overrides,
  };
}

export function writeLesson(overrides: Record<string, unknown> = {}): void {
  write('lessons/w1/demo-lesson.yaml', stringify(validLesson(overrides)));
}

export function writeMiniGame(overrides: Record<string, unknown> = {}): void {
  write('minigames/mg1.yaml', stringify(validMiniGame(overrides)));
}

export function writeDefaultLocales(): void {
  write(
    'locales/en/lessons.yaml',
    stringify({
      'demo-lesson': { title: 'Title', story: 'Story' },
      'demo-demo': 'Demo',
      'demo-01': 'Exercise',
      'opt-a': 'Option A',
      'opt-b': 'Option B',
      mg1: { title: 'Title', goal: 'Goal' },
    }),
  );
  write('locales/en/characters.yaml', stringify({ char1: { name: 'Char' } }));
}

/** Everything `compileAll` reads: the lesson, mini-game and locales above, plus one track, one
 * rank and one badge, with the journey / rewards texts and the platform's subject-owned common texts. */
export function writeFullContent(): void {
  writeLesson();
  writeMiniGame();
  writeDefaultLocales();
  write(
    'tracks.yaml',
    stringify({
      tracks: [
        {
          id: 'basics',
          kind: 'main',
          title: 'tracks.basics',
          worlds: [{ id: 'w1', order: 1, habitat: 'meadow', title: 'worlds.board' }],
        },
      ],
      ranks: [{ id: 'pawn', after: 'start' }],
    }),
  );
  write(
    'badges.yaml',
    stringify({
      badges: [
        {
          id: 'fixture-stars',
          category: 'milestone',
          condition: { type: 'stars-total', thresholds: [1] },
        },
      ],
    }),
  );
  write(
    'locales/en/rewards.yaml',
    stringify({ badges: { 'fixture-stars': { name: 'Stars', condition: 'Earn a star' } } }),
  );
  write(
    'locales/en/journey.yaml',
    stringify({
      tracks: { basics: 'Basics' },
      worlds: { board: 'Board' },
      ranks: { pawn: 'Pawn' },
    }),
  );
  // Texts the platform's voice inventory reads from `common` but does not itself provide.
  write(
    'locales/en/common.yaml',
    stringify({
      'voice-check': { sentence: 'Say hello' },
      'time-limit': { 'early-body': 'Opens at {{time}}' },
      placement: { 'offer-question': 'Want to start?', 'summary-none-body': 'Start here' },
    }),
  );
}

export function load(): void {
  const locales = loadLocales(join(dir, 'locales'));
  loadContent(join(dir, 'lessons'), join(dir, 'minigames'), locales, fixtureSubject);
}

export function issuesOf(): string[] {
  try {
    load();
    return [];
  } catch (error) {
    if (error instanceof ContentError) return [...error.issues];
    throw error;
  }
}
