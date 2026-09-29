// The authored math content: every exercise plays through its own kind, and every text it or the app shell reads exists.
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { compileAll } from '@learn/platform-content/compile-all';
import type { LocaleTree } from '@learn/platform-content/schema';
import { exerciseNote } from '@learn/platform-core/domain/notes';
import type { Resolve } from '@learn/platform-core/domain/notes';
import { MATH_NOTES } from '../core/notes.ts';
import type { MathFeedback } from '../core/notes.ts';
import type { MathContent, MathExerciseDef } from '../core/types.ts';
import { playSolution, playWrongThenSolve, starsFor } from '../testing/play.ts';
import { mathContent } from './math-content.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'content');
const compiled = compileAll<MathContent>(mathContent, root);
const { content, tracks, badges, locales } = compiled;

function allExercises(): readonly { readonly where: string; readonly exercise: MathExerciseDef }[] {
  const all: { readonly where: string; readonly exercise: MathExerciseDef }[] = [];
  for (const lesson of content.lessons) {
    for (const exercise of [...lesson.guided, ...lesson.exercises, ...(lesson.variants ?? [])]) {
      all.push({ where: `${lesson.id}/${exercise.id}`, exercise });
    }
  }
  for (const minigame of content.minigames) {
    for (const round of minigame.rounds) {
      all.push({ where: `${minigame.id}/${round.id}`, exercise: round });
    }
  }
  return all;
}

describe.each(allExercises())('$where ($exercise.type)', ({ exercise }) => {
  it('solution() solves cleanly from a fresh state, with 3 stars', () => {
    const solved = playSolution(exercise);
    expect(solved.solved).toBe(true);
    expect(solved.errors).toBe(0);
    expect(starsFor(solved)).toBe(3);
  });

  it('wrongAction() costs exactly 1 error and does not block solving', () => {
    const wrong = playWrongThenSolve(exercise);
    expect(wrong.errors).toBe(1);
    expect(wrong.solved).toBe(true);
  });
});

describe('the authored world', () => {
  it('has 3 lessons of 1 guided and 4 exercises, taught by Hedgie then Owl', () => {
    const byOrder = [...content.lessons].sort((a, b) => a.order - b.order);
    expect(
      byOrder.map((lesson) => [
        lesson.id,
        lesson.world,
        lesson.order,
        lesson.character,
        lesson.guided.length,
        lesson.exercises.length,
      ]),
    ).toEqual([
      ['add-within-5', 'adding', 1, 'hedgehog', 1, 4],
      ['add-within-10', 'adding', 2, 'owl', 1, 4],
      ['take-away', 'adding', 3, 'owl', 1, 4],
    ]);
  });

  it('uses both kinds and both operators', () => {
    const exercises = allExercises().map(({ exercise }) => exercise);
    expect(new Set(exercises.map((exercise) => exercise.type))).toEqual(
      new Set(['choice', 'number-entry']),
    );
    expect(new Set(exercises.map((exercise) => exercise.problem?.op))).toEqual(new Set(['+', '-']));
  });

  it('ends with the Number Parade world boss: 6 rounds, 3 stars up to 0 mistakes, 2 up to 2', () => {
    const [main] = tracks.tracks;
    expect(main).toMatchObject({ id: 'numbers', kind: 'main' });
    expect(main?.worlds).toEqual([
      expect.objectContaining({ id: 'adding', habitat: 'meadow', boss: 'number-parade' }),
    ]);
    const [boss] = content.minigames;
    expect(boss).toMatchObject({
      id: 'number-parade',
      mode: 'series',
      unlockAfter: 'take-away',
      errors3: 0,
      errors2: 2,
    });
    expect(boss?.rounds).toHaveLength(6);
    expect(boss?.rounds.map((round) => round.type)).toEqual([
      'number-entry',
      'choice',
      'number-entry',
      'number-entry',
      'choice',
      'number-entry',
    ]);
  });

  it('has the counter and adder ranks and 2 badges', () => {
    expect(tracks.ranks).toEqual([
      { id: 'counter', after: 'start' },
      { id: 'adder', after: 'world:adding' },
    ]);
    expect(badges.map((badge) => badge.id)).toEqual(['first-sums', 'star-counter']);
  });
});

function lookup(tree: LocaleTree | undefined, path: string): string | undefined {
  let node: string | LocaleTree | undefined = tree;
  for (const segment of path.split('.')) {
    if (typeof node !== 'object') return undefined;
    node = node[segment];
  }
  return typeof node === 'string' ? node : undefined;
}

/** i18next-alike over the built `en` locale: `namespace:path` (default `common`), `_one` / `_other` on `count`,
 * `{{var}}` interpolation; a missing key throws. */
const resolve: Resolve = (key, vars = {}) => {
  const [namespace = 'common', path = key] = key.includes(':') ? key.split(':') : ['common', key];
  const tree = locales.en?.[namespace];
  const suffix = typeof vars.count === 'number' ? (vars.count === 1 ? '_one' : '_other') : '';
  const text = lookup(tree, `${path}${suffix}`) ?? lookup(tree, path);
  if (text === undefined) throw new Error(`missing text key "${key}"`);
  return text.replace(/\{\{(\w+)\}\}/g, (whole, name: string) => String(vars[name] ?? whole));
};

describe('texts', () => {
  it('the app shell texts every subject supplies say "Math"', () => {
    expect(resolve('app.title')).toBe('Math for Kids');
    for (const key of [
      'parent.privacy.intro',
      'voice-check.sentence',
      'placement.offer-question',
      'placement.summary-none-body',
    ]) {
      expect(resolve(key), key).toMatch(/math/i);
    }
    expect(resolve('time-limit.early-body', { time: '09:00' })).toBe(
      'Math opens at 09:00. See you soon!',
    );
  });

  it('the number pad, the topic and every character resolve', () => {
    expect(resolve('math.pad-label')).toBe('Number pad');
    expect(resolve('math.erase')).toBe('Delete');
    expect(resolve('math.entry-label', { value: 7 })).toBe('Your answer: 7');
    expect(resolve('topic.counter')).toBe('Counter');
    for (const lesson of content.lessons) {
      expect(resolve(`characters:${lesson.character}.name`)).not.toBe('');
    }
  });

  it('every note the Owl bubble can say resolves, with no placeholder left', () => {
    const problem = { a: 3, op: '+', b: 2 } as const;
    const feedback: readonly MathFeedback[] = [
      { kind: 'wrong-answer' },
      { kind: 'solved' },
      { kind: 'hint', hint: { kind: 'choice', level: 1, reveal: false } },
      { kind: 'hint', hint: { kind: 'choice', level: 3, reveal: true } },
      { kind: 'hint', hint: { kind: 'number-entry', level: 1, reveal: false } },
      { kind: 'hint', hint: { kind: 'number-entry', level: 2, reveal: false } },
      { kind: 'hint', hint: { kind: 'number-entry', level: 2, reveal: false, problem } },
      {
        kind: 'hint',
        hint: { kind: 'number-entry', level: 2, reveal: false, problem: { ...problem, op: '-' } },
      },
      { kind: 'hint', hint: { kind: 'number-entry', level: 3, reveal: true } },
    ];
    for (const stars of [1, 2, 3] as const) {
      for (const entry of feedback) {
        for (const offer of [false, true]) {
          const note = exerciseNote(
            resolve,
            entry,
            { name: 'Owl', stars, vars: {} },
            MATH_NOTES,
            offer,
          );
          expect(note?.text, JSON.stringify(entry)).toMatch(/^[^{]+$/);
        }
      }
    }
  });
});
