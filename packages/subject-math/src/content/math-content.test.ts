// The math content rules: what a lesson file may say and what the build refuses, over a scratch lesson.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { stringify } from 'yaml';
import { loadContent } from '@learn/platform-content/lesson-load';
import { ContentError, loadLocales, mergeLocales } from '@learn/platform-content/load';
import { PLATFORM_LOCALES_DIR } from '@learn/platform-content/paths';
import type { MathContent } from '../core/types.ts';
import { mathContent, mathDemo, mathStimulus } from './math-content.ts';

const realLocalesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'content',
  'locales',
);
const locales = mergeLocales(loadLocales(PLATFORM_LOCALES_DIR), loadLocales(realLocalesDir));

let dir = '';

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'math-content-'));
  mkdirSync(join(dir, 'minigames'), { recursive: true });
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** Text keys come from the real `lessons.yaml`: the ids used here (`add5-01`, `add5-02`, `add5-03`) have texts. */
function numberEntry(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { id: 'add5-01', type: 'number-entry', problem: '2 + 2', answer: 4, ...overrides };
}

function choice(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'add5-01',
    type: 'choice',
    problem: '2 + 2',
    options: [
      { id: 'a', value: 3 },
      { id: 'b', value: 4 },
    ],
    answer: 'b',
    ...overrides,
  };
}

function load(exercises: readonly unknown[], demo: unknown = { problem: '2 + 1' }): MathContent {
  const lessonPath = join(dir, 'lessons', 'adding', 'add-within-5.yaml');
  mkdirSync(dirname(lessonPath), { recursive: true });
  writeFileSync(
    lessonPath,
    stringify({
      id: 'add-within-5',
      order: 1,
      concept: 'add-within-5',
      character: 'hedgehog',
      demo,
      guided: [],
      exercises,
    }),
    'utf8',
  );
  return loadContent<MathContent>(
    join(dir, 'lessons'),
    join(dir, 'minigames'),
    locales,
    mathContent,
  );
}

function issuesOf(exercises: readonly unknown[], demo?: unknown): readonly string[] {
  try {
    load(exercises, demo);
    return [];
  } catch (error) {
    if (error instanceof ContentError) return error.issues;
    throw error;
  }
}

describe('math exercises', () => {
  it('compiles the problem into the def head', () => {
    const [lesson] = load([numberEntry(), choice({ id: 'add5-02' })]).lessons;
    expect(lesson?.exercises).toEqual([
      {
        id: 'add5-01',
        concept: 'add-within-5',
        textKey: 'lessons:add5-01',
        problem: { a: 2, op: '+', b: 2 },
        type: 'number-entry',
        answer: 4,
      },
      {
        id: 'add5-02',
        concept: 'add-within-5',
        textKey: 'lessons:add5-02',
        problem: { a: 2, op: '+', b: 2 },
        type: 'choice',
        options: [
          { id: 'a', value: 3 },
          { id: 'b', value: 4 },
        ],
        answer: 'b',
      },
    ]);
  });

  it('loads a text-only choice with no problem', () => {
    expect(
      issuesOf([
        choice({
          problem: undefined,
          options: [
            { id: 'a', text: 'add5-02' },
            { id: 'b', text: 'add5-03' },
          ],
        }),
      ]),
    ).toEqual([]);
  });

  it.each(['2 plus 2', '2+2', '100 + 1'])('rejects the problem "%s"', (problem) => {
    expect(issuesOf([numberEntry({ problem })]).some((issue) => issue.includes('problem'))).toBe(
      true,
    );
  });

  it('a number-entry needs a problem', () => {
    expect(issuesOf([numberEntry({ problem: undefined })]).join('\n')).toContain('problem');
  });

  it('rejects a difference below zero and a result above 20', () => {
    expect(issuesOf([numberEntry({ problem: '1 - 2', answer: 0 })]).join('\n')).toContain(
      '"1 - 2" goes below zero',
    );
    expect(issuesOf([numberEntry({ problem: '15 + 9', answer: 24 })]).join('\n')).toContain(
      '"15 + 9" is above 20',
    );
    expect(issuesOf([numberEntry({ problem: '20 + 0', answer: 20 })])).toEqual([]);
    expect(issuesOf([numberEntry({ problem: '4 - 4', answer: 0 })])).toEqual([]);
  });

  it('rejects a number-entry answer that is not the problem result, or out of range', () => {
    expect(issuesOf([numberEntry({ answer: 5 })]).join('\n')).toContain(
      'answer 5 but the problem is 4',
    );
    expect(issuesOf([numberEntry({ answer: 100 })]).join('\n')).toContain('answer');
    expect(issuesOf([numberEntry({ answer: 1.5 })]).join('\n')).toContain('answer');
  });

  it('a choice needs exactly one option equal to the result, and it must be the answer', () => {
    const wrongValues = choice({
      options: [
        { id: 'a', value: 3 },
        { id: 'b', value: 5 },
      ],
    });
    const twice = choice({
      options: [
        { id: 'a', value: 4 },
        { id: 'b', value: 4 },
      ],
    });
    const otherAnswer = choice({ answer: 'a' });
    for (const exercise of [wrongValues, twice, otherAnswer]) {
      expect(issuesOf([exercise]).join('\n')).toContain('exactly one option must equal 4');
    }
  });

  it('an option needs text or a value, and a value is 0-99', () => {
    const bare = choice({
      options: [{ id: 'a' }, { id: 'b', value: 4 }],
    });
    expect(issuesOf([bare]).join('\n')).toContain('option needs "text" or "value"');
    const big = choice({
      options: [
        { id: 'a', value: 100 },
        { id: 'b', value: 4 },
      ],
    });
    expect(issuesOf([big]).join('\n')).toContain('value');
  });
});

describe('math demo', () => {
  it('compiles the problem and the default text key', () => {
    const [lesson] = load([numberEntry()], { problem: '6 + 3' }).lessons;
    expect(lesson?.demo).toEqual({
      textKey: 'lessons:add-within-5.demo',
      problem: { a: 6, op: '+', b: 3 },
    });
  });

  it('needs a problem, and holds it to the same rules', () => {
    expect(issuesOf([numberEntry()], {}).join('\n')).toContain('demo.problem');
    expect(issuesOf([numberEntry()], { problem: '1 - 2' }).join('\n')).toContain('goes below zero');
  });
});

describe('math stimulus and demo, compiled directly', () => {
  const at = () => ({ where: 'x.yaml: exercises[0]', issues: [] as string[] });

  it('an exercise with no problem has no head', () => {
    expect(mathStimulus.compile({}, at())).toEqual({ head: {}, tail: {} });
  });

  it('reports a problem that is not a sum or a difference', () => {
    const here = at();
    expect(mathStimulus.compile({ problem: 'nonsense' }, here)).toBeNull();
    expect(here.issues).toEqual(['x.yaml: exercises[0].problem: not a sum or a difference']);
    const demo = at();
    expect(mathDemo.compile({ problem: 'nonsense' }, 'lessons:k', demo)).toBeNull();
    expect(demo.issues).toHaveLength(1);
  });
});
