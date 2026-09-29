import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { stringify } from 'yaml';
import { loadContent } from '../lesson-load.ts';
import { createExerciseSchema } from '../lesson-schema.ts';
import { loadLocales } from '../load.ts';
import type { SubjectContent } from '../subject.ts';
import {
  dir,
  fixturesAfterEach,
  fixturesBeforeEach,
  fixtureKinds,
  fixtureSubject,
  issuesOf,
  validExercise,
  write,
  writeDefaultLocales,
  writeLesson,
} from '../testing/fixture-subject.ts';
import { createSeriesContent } from './series.ts';

beforeEach(fixturesBeforeEach);
afterEach(fixturesAfterEach);

const series = createSeriesContent(createExerciseSchema(fixtureKinds, fixtureSubject.stimulus));
const subject: SubjectContent = {
  ...fixtureSubject,
  modes: { ...fixtureSubject.modes, series },
};

/** A `series` mini-game file over the fixture's `answer` exercises. */
function writeSeries(overrides: Record<string, unknown> = {}): void {
  write(
    'minigames/mg1.yaml',
    stringify({
      id: 'mg1',
      concept: 'c1',
      unlockAfter: 'demo-lesson',
      mode: 'series',
      errors3: 0,
      errors2: 2,
      rounds: [validExercise({ id: 'r-01' })],
      ...overrides,
    }),
  );
}

describe('createSeriesContent', () => {
  it('compiles rounds through the subject kinds, keeping the compiled key order', () => {
    writeLesson();
    writeSeries();
    writeDefaultLocales();

    expect(issuesOf(subject)).toEqual([]);
    const [game] = loadContent(
      join(dir, 'lessons'),
      join(dir, 'minigames'),
      loadLocales(join(dir, 'locales')),
      subject,
    ).minigames;
    expect(Object.keys(game ?? {})).toEqual([
      'mode',
      'id',
      'concept',
      'rounds',
      'errors3',
      'errors2',
      'titleKey',
      'goalKey',
      'unlockAfter',
    ]);
  });

  it('rejects errors2 below errors3', () => {
    writeLesson();
    writeSeries({ errors3: 3, errors2: 1 });
    writeDefaultLocales();

    expect(
      issuesOf(subject).some((issue) => issue.includes('"errors2" must be >= "errors3"')),
    ).toBe(true);
  });

  it('verifies each round like a lesson exercise, with its own path', () => {
    writeLesson();
    writeSeries({ rounds: [validExercise({ id: 'r-01', text: 'no-such-key' })] });
    writeDefaultLocales();

    expect(
      issuesOf(subject).some(
        (issue) =>
          issue.startsWith('minigames/mg1.yaml: rounds[0]') &&
          issue.includes('missing text key "lessons:no-such-key"'),
      ),
    ).toBe(true);
  });
});
