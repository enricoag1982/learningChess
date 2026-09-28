import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { stringify } from 'yaml';
import { loadLocales } from './load.ts';
import { loadContent } from './lesson-load.ts';
import {
  diagram,
  dir,
  fixturesAfterEach,
  fixturesBeforeEach,
  issuesOf,
  validBestMoveExercise,
  validChoiceExercise,
  validEnPassantVerifyExercise,
  validExercise,
  validSetupExercise,
  validYesNoExercise,
  write,
  writeDefaultLocales,
  writeLesson,
  writeMiniGame,
} from './testing/fixtures.ts';

beforeEach(fixturesBeforeEach);
afterEach(fixturesAfterEach);

describe('loadContent', () => {
  it('loads a valid lesson and mini-game with no issues', () => {
    writeLesson();
    writeMiniGame();
    writeDefaultLocales();

    expect(issuesOf()).toEqual([]);
  });
  it('reports an invalid board diagram', () => {
    writeLesson({ exercises: [validExercise({ board: 'not a board' })] });
    writeMiniGame();
    writeDefaultLocales();

    const issues = issuesOf();
    expect(issues.some((issue) => issue.includes('exercises[0].board'))).toBe(true);
    expect(issues.some((issue) => issue.includes('expected 8 rows'))).toBe(true);
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

      const locales = loadLocales(join(dir, 'locales'));
      const content = loadContent(join(dir, 'lessons'), join(dir, 'minigames'), locales);
      const lesson = content.lessons.find((entry) => entry.id === 'demo-lesson');
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
  it('reports a position with no piece for the side to move', () => {
    writeLesson({ exercises: [validExercise({ board: diagram({ d5: '*' }) })] });
    writeMiniGame();
    writeDefaultLocales();

    const issues = issuesOf();
    expect(issues.some((issue) => issue.includes('side to move has no piece'))).toBe(true);
  });
  it('reports multiple issues across files together', () => {
    writeLesson({ boss: 'no-such-minigame', exercises: [validExercise({ text: 'missing-key' })] });
    writeDefaultLocales();

    const issues = issuesOf();
    expect(issues.length).toBeGreaterThanOrEqual(2);
    expect(issues.some((issue) => issue.includes('unknown mini-game'))).toBe(true);
    expect(issues.some((issue) => issue.includes('missing text key'))).toBe(true);
  });
  describe('lastMove field', () => {
    it('loads a valid lastMove (piece on "to") with no issues', () => {
      writeLesson({ exercises: [validBestMoveExercise({ lastMove: 'a2a1' })] });
      writeMiniGame();
      writeDefaultLocales();

      expect(issuesOf()).toEqual([]);
    });

    it('rejects a lastMove with no piece on "to"', () => {
      writeLesson({ exercises: [validBestMoveExercise({ lastMove: 'a2a3' })] });
      writeMiniGame();
      writeDefaultLocales();

      const issues = issuesOf();
      expect(issues.some((issue) => issue.includes('lastMove "a2a3": no piece on a3'))).toBe(true);
    });

    it('loads a valid lastMove matching the en passant double step with no issues', () => {
      writeLesson({ exercises: [validEnPassantVerifyExercise({ lastMove: 'd7d5' })] });
      writeMiniGame();
      writeDefaultLocales();

      expect(issuesOf()).toEqual([]);
    });

    it('rejects a lastMove that is not the double step matching the en passant square', () => {
      writeLesson({ exercises: [validEnPassantVerifyExercise({ lastMove: 'c7d5' })] });
      writeMiniGame();
      writeDefaultLocales();

      const issues = issuesOf();
      expect(
        issues.some((issue) =>
          issue.includes('lastMove "c7d5" is not the double step matching en passant square d6'),
        ),
      ).toBe(true);
    });
  });
  it('loads a fixture lesson using all four new exercise types with no issues', () => {
    writeLesson({
      guided: [],
      exercises: [
        validYesNoExercise({ id: 'yn-01' }),
        validChoiceExercise({ id: 'ch-01' }),
        validBestMoveExercise({ id: 'bm-01' }),
        validSetupExercise({ id: 'su-01' }),
      ],
    });
    writeMiniGame();
    writeDefaultLocales();

    expect(issuesOf()).toEqual([]);
  });

  it('reports a choice option referencing a missing text key (kind content textKeys)', () => {
    writeLesson({
      exercises: [
        validChoiceExercise({
          options: [
            { id: 'rook', text: 'no-such-option-key' },
            { id: 'pawn', piece: 'P' },
          ],
        }),
      ],
    });
    writeMiniGame();
    writeDefaultLocales();

    const issues = issuesOf();
    expect(
      issues.some(
        (issue) =>
          issue.includes('missing text key "lessons:no-such-option-key"') &&
          issue.includes('option "rook"'),
      ),
    ).toBe(true);
  });

  describe('YAML defaults', () => {
    it('defaults exercise text to id', () => {
      writeLesson({ exercises: [validExercise({ text: undefined })] });
      writeMiniGame();
      writeDefaultLocales();

      expect(issuesOf()).toEqual([]);
      const locales = loadLocales(join(dir, 'locales'));
      const content = loadContent(join(dir, 'lessons'), join(dir, 'minigames'), locales);
      expect(content.lessons[0]?.exercises[0]?.textKey).toBe('lessons:demo-01');
    });

    it('defaults lesson world to its folder name', () => {
      writeLesson({ world: undefined });
      writeMiniGame();
      writeDefaultLocales();

      expect(issuesOf()).toEqual([]);
      const locales = loadLocales(join(dir, 'locales'));
      const content = loadContent(join(dir, 'lessons'), join(dir, 'minigames'), locales);
      expect(content.lessons[0]?.world).toBe('w1');
    });

    it('defaults lesson title/story to <id>.title/<id>.story', () => {
      writeLesson({ title: undefined, story: undefined });
      writeMiniGame();
      writeDefaultLocales();

      expect(issuesOf()).toEqual([]);
      const locales = loadLocales(join(dir, 'locales'));
      const content = loadContent(join(dir, 'lessons'), join(dir, 'minigames'), locales);
      expect(content.lessons[0]?.titleKey).toBe('lessons:demo-lesson.title');
      expect(content.lessons[0]?.storyKey).toBe('lessons:demo-lesson.story');
    });

    it('defaults demo text to <lesson-id>.demo', () => {
      writeLesson({ demo: { board: diagram({ d4: 'R' }), highlight: 'legal-moves d4' } });
      writeMiniGame();
      write(
        'locales/en/lessons.yaml',
        stringify({
          'demo-lesson': { title: 'Title', story: 'Story', demo: 'Demo' },
          'demo-01': 'Exercise',
          mg1: { title: 'Title', goal: 'Goal' },
        }),
      );
      write('locales/en/characters.yaml', stringify({ char1: { name: 'Char' } }));

      expect(issuesOf()).toEqual([]);
      const locales = loadLocales(join(dir, 'locales'));
      const content = loadContent(join(dir, 'lessons'), join(dir, 'minigames'), locales);
      expect(content.lessons[0]?.demo.textKey).toBe('lessons:demo-lesson.demo');
    });

    it('defaults mini-game title/goal to <id>.title/<id>.goal', () => {
      writeLesson();
      writeMiniGame({ title: undefined, goal: undefined });
      writeDefaultLocales();

      expect(issuesOf()).toEqual([]);
      const locales = loadLocales(join(dir, 'locales'));
      const content = loadContent(join(dir, 'lessons'), join(dir, 'minigames'), locales);
      expect(content.minigames[0]?.titleKey).toBe('lessons:mg1.title');
      expect(content.minigames[0]?.goalKey).toBe('lessons:mg1.goal');
    });
  });
});
