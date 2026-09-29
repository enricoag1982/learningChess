import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { stringify } from 'yaml';
import { loadContent } from './lesson-load.ts';
import { loadLocales } from './load.ts';
import {
  dir,
  fixturesAfterEach,
  fixturesBeforeEach,
  fixtureSubject,
  issuesOf,
  validExercise,
  write,
  writeDefaultLocales,
  writeLesson,
  writeMiniGame,
} from './testing/fixture-subject.ts';

beforeEach(fixturesBeforeEach);
afterEach(fixturesAfterEach);

/** Loads the scratch directory's content (the caller has already checked it has no issues). */
function loaded() {
  return loadContent(
    join(dir, 'lessons'),
    join(dir, 'minigames'),
    loadLocales(join(dir, 'locales')),
    fixtureSubject,
  );
}

describe('loadContent', () => {
  it('loads a valid lesson and mini-game with no issues', () => {
    writeLesson();
    writeMiniGame();
    writeDefaultLocales();

    expect(issuesOf()).toEqual([]);
  });

  it('reports a missing text key', () => {
    writeLesson({ exercises: [validExercise({ text: 'no-such-key' })] });
    writeMiniGame();
    writeDefaultLocales();

    const issues = issuesOf();
    expect(issues.some((issue) => issue.includes('missing text key "lessons:no-such-key"'))).toBe(
      true,
    );
  });

  it('reports a duplicate id', () => {
    writeLesson({ exercises: [validExercise(), validExercise()] });
    writeMiniGame();
    writeDefaultLocales();

    const issues = issuesOf();
    expect(issues.some((issue) => issue.includes('duplicate id "demo-01"'))).toBe(true);
  });

  it('reports an unknown boss reference', () => {
    writeLesson({ boss: 'no-such-minigame' });
    writeDefaultLocales();
    // No mini-game file at all.

    const issues = issuesOf();
    expect(issues.some((issue) => issue.includes('unknown mini-game "no-such-minigame"'))).toBe(
      true,
    );
  });

  it('reports an unrecognized YAML key', () => {
    writeLesson({ notAField: true });
    writeMiniGame();
    writeDefaultLocales();

    const issues = issuesOf();
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0]).toContain('demo-lesson.yaml');
  });

  describe('easier / variants', () => {
    it('reports an unknown variant reference', () => {
      writeLesson({ exercises: [validExercise({ easier: 'no-such-variant' })] });
      writeMiniGame();
      writeDefaultLocales();

      const issues = issuesOf();
      expect(
        issues.some((issue) =>
          issue.includes(
            'easier references unknown variant "no-such-variant" (must be in this lesson\'s variants)',
          ),
        ),
      ).toBe(true);
    });

    it('rejects easier on a guided try', () => {
      writeLesson({
        guided: [validExercise({ id: 'demo-g1', easier: 'demo-01-easy' })],
        exercises: [validExercise()],
        variants: [validExercise({ id: 'demo-01-easy' })],
      });
      writeMiniGame();
      writeDefaultLocales();

      const issues = issuesOf();
      expect(
        issues.some((issue) => issue.includes('demo-g1: easier is only for scored exercises')),
      ).toBe(true);
    });

    it('rejects a variant with its own easier', () => {
      writeLesson({
        exercises: [validExercise({ easier: 'demo-01-easy' })],
        variants: [validExercise({ id: 'demo-01-easy', easier: 'demo-01' })],
      });
      writeMiniGame();
      writeDefaultLocales();

      const issues = issuesOf();
      expect(
        issues.some((issue) =>
          issue.includes('demo-01-easy: a variant cannot have its own easier'),
        ),
      ).toBe(true);
    });

    it('reports a variant referenced by no exercise', () => {
      writeLesson({
        exercises: [validExercise()],
        variants: [validExercise({ id: 'demo-01-easy' })],
      });
      writeMiniGame();
      writeDefaultLocales();

      const issues = issuesOf();
      expect(
        issues.some((issue) =>
          issue.includes("demo-01-easy: variant is not referenced by any exercise's easier"),
        ),
      ).toBe(true);
    });

    it('loads a scored exercise with easier and its matching variant with no issues', () => {
      writeLesson({
        exercises: [validExercise({ easier: 'demo-01-easy' })],
        variants: [validExercise({ id: 'demo-01-easy' })],
      });
      writeMiniGame();
      writeDefaultLocales();

      expect(issuesOf()).toEqual([]);

      const lesson = loaded().lessons.find((entry) => entry.id === 'demo-lesson');
      if (lesson === undefined) {
        throw new Error('demo-lesson not found');
      }
      expect(lesson.exercises[0]?.easier).toBe('demo-01-easy');
      expect(lesson.variants?.map((variant) => variant.id)).toEqual(['demo-01-easy']);
    });
  });

  it('reports an unknown unlockAfter reference', () => {
    writeLesson();
    writeMiniGame({ unlockAfter: 'no-such-lesson' });
    writeDefaultLocales();

    const issues = issuesOf();
    expect(issues.some((issue) => issue.includes('unknown lesson "no-such-lesson"'))).toBe(true);
  });

  it('reports multiple issues across files together', () => {
    writeLesson({ boss: 'no-such-minigame', exercises: [validExercise({ text: 'missing-key' })] });
    writeDefaultLocales();

    const issues = issuesOf();
    expect(issues.length).toBeGreaterThanOrEqual(2);
    expect(issues.some((issue) => issue.includes('unknown mini-game'))).toBe(true);
    expect(issues.some((issue) => issue.includes('missing text key'))).toBe(true);
  });

  describe('YAML defaults', () => {
    it('defaults exercise text to id', () => {
      writeLesson({ exercises: [validExercise({ text: undefined })] });
      writeMiniGame();
      writeDefaultLocales();

      expect(issuesOf()).toEqual([]);
      expect(loaded().lessons[0]?.exercises[0]?.textKey).toBe('lessons:demo-01');
    });

    it('defaults lesson world to its folder name', () => {
      writeLesson({ world: undefined });
      writeMiniGame();
      writeDefaultLocales();

      expect(issuesOf()).toEqual([]);
      expect(loaded().lessons[0]?.world).toBe('w1');
    });

    it('defaults lesson title/story to <id>.title/<id>.story', () => {
      writeLesson({ title: undefined, story: undefined });
      writeMiniGame();
      writeDefaultLocales();

      expect(issuesOf()).toEqual([]);
      expect(loaded().lessons[0]?.titleKey).toBe('lessons:demo-lesson.title');
      expect(loaded().lessons[0]?.storyKey).toBe('lessons:demo-lesson.story');
    });

    it('defaults demo text to <lesson-id>.demo', () => {
      writeLesson({ demo: { label: 'Demo' } });
      writeMiniGame();
      write(
        'locales/en/lessons.yaml',
        stringify({
          'demo-lesson': { title: 'Title', story: 'Story', demo: 'Demo' },
          'demo-01': 'Exercise',
          'opt-a': 'Option A',
          'opt-b': 'Option B',
          mg1: { title: 'Title', goal: 'Goal' },
        }),
      );
      write('locales/en/characters.yaml', stringify({ char1: { name: 'Char' } }));

      expect(issuesOf()).toEqual([]);
      expect(loaded().lessons[0]?.demo.textKey).toBe('lessons:demo-lesson.demo');
    });

    it('defaults mini-game title/goal to <id>.title/<id>.goal', () => {
      writeLesson();
      writeMiniGame({ title: undefined, goal: undefined });
      writeDefaultLocales();

      expect(issuesOf()).toEqual([]);
      expect(loaded().minigames[0]?.titleKey).toBe('lessons:mg1.title');
      expect(loaded().minigames[0]?.goalKey).toBe('lessons:mg1.goal');
    });
  });
});

describe('loadContent through the subject registries', () => {
  it("reports a field the exercise's own kind schema rejects", () => {
    writeLesson({ exercises: [validExercise({ options: ['opt-a'] })] });
    writeMiniGame();
    writeDefaultLocales();

    expect(issuesOf().some((issue) => issue.includes('exercises.0.options'))).toBe(true);
  });

  it('reports an unknown exercise type instead of dropping the lesson', () => {
    writeLesson({ exercises: [validExercise({ type: 'no-such-kind' })] });
    writeMiniGame();
    writeDefaultLocales();

    expect(issuesOf().some((issue) => issue.includes('exercises.0'))).toBe(true);
  });

  it("verifies through the exercise's own kind", () => {
    writeLesson({ exercises: [validExercise({ correct: 5 })] });
    writeMiniGame();
    writeDefaultLocales();

    expect(issuesOf().some((issue) => issue.includes('correct 5 is not an option'))).toBe(true);
  });

  it('checks the extra text keys a kind reports', () => {
    writeLesson({ exercises: [validExercise({ options: ['opt-a', 'no-such-option'] })] });
    writeMiniGame();
    writeDefaultLocales();

    expect(
      issuesOf().some(
        (issue) =>
          issue.includes('missing text key "lessons:no-such-option"') && issue.includes('option 1'),
      ),
    ).toBe(true);
  });

  it('runs the subject stimulus check, unless the kind opts out', () => {
    writeLesson({
      exercises: [
        validExercise({ id: 'ans-01', text: 'demo-01', prompt: ' ' }),
        { id: 'read-01', type: 'read', text: 'demo-01', prompt: ' ' },
      ],
    });
    writeMiniGame();
    writeDefaultLocales();

    const issues = issuesOf().filter((issue) => issue.includes('blank prompt'));
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain('ans-01');
  });

  it('splices the stimulus head into the compiled exercise', () => {
    writeLesson({ exercises: [validExercise({ prompt: 'Pick one' })] });
    writeMiniGame();
    writeDefaultLocales();

    expect(issuesOf()).toEqual([]);
    expect(loaded().lessons[0]?.exercises[0]).toEqual({
      id: 'demo-01',
      concept: 'c1',
      textKey: 'lessons:demo-01',
      prompt: 'Pick one',
      type: 'answer',
      options: ['opt-a', 'opt-b'],
      correct: 1,
    });
  });

  describe('mini-game modes', () => {
    /** A `rounds` mini-game file: no `par`, exercises instead. */
    function writeRounds(rounds: readonly Record<string, unknown>[]): void {
      write(
        'minigames/mg1.yaml',
        stringify({ id: 'mg1', concept: 'c1', unlockAfter: 'demo-lesson', mode: 'rounds', rounds }),
      );
    }

    it('takes a file without `mode` as the static mode', () => {
      writeLesson();
      writeMiniGame();
      writeDefaultLocales();

      expect(issuesOf()).toEqual([]);
      expect(loaded().minigames[0]).toMatchObject({ mode: 'static', par: 3 });
    });

    it("compiles a mode's own exercises through the kind registry", () => {
      writeLesson();
      writeRounds([validExercise({ id: 'r-01', text: 'demo-01', prompt: 'Round' })]);
      writeDefaultLocales();

      expect(issuesOf()).toEqual([]);
      expect(loaded().minigames[0]).toMatchObject({
        mode: 'rounds',
        rounds: [{ id: 'r-01', type: 'answer', textKey: 'lessons:demo-01', prompt: 'Round' }],
      });
    });

    it('verifies each round like a lesson exercise, with its own path', () => {
      writeLesson();
      writeRounds([validExercise({ id: 'r-01', text: 'no-such-key', prompt: ' ' })]);
      writeDefaultLocales();

      const issues = issuesOf();
      expect(
        issues.some(
          (issue) =>
            issue.startsWith('minigames/mg1.yaml: rounds[0]') &&
            issue.includes('missing text key "lessons:no-such-key"'),
        ),
      ).toBe(true);
      expect(issues.some((issue) => issue.includes('rounds[0]: blank prompt'))).toBe(true);
    });

    it('shares the id namespace between lessons and rounds', () => {
      writeLesson();
      writeRounds([validExercise()]);
      writeDefaultLocales();

      expect(issuesOf().some((issue) => issue.includes('duplicate id "demo-01"'))).toBe(true);
    });

    it('reports a file matching no mode against every mode', () => {
      writeLesson();
      write(
        'minigames/mg1.yaml',
        stringify({ id: 'mg1', concept: 'c1', unlockAfter: 'demo-lesson' }),
      );
      writeDefaultLocales();

      const issues = issuesOf();
      expect(issues.some((issue) => issue.includes('mg1.yaml: par'))).toBe(true);
      expect(issues.some((issue) => issue.includes('mg1.yaml: rounds'))).toBe(true);
    });
  });
});
