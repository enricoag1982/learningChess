import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ContentError, compareToReference, loadLocales } from './load.ts';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'chess-kids-content-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** Writes one fixture file (and its parent directories) under the temp locales dir. */
function write(relPath: string, content: string): void {
  const filePath = join(dir, relPath);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, 'utf8');
}

/** Runs {@link loadLocales} and returns its issues, or `[]` if it did not throw. */
function issuesOf(): string[] {
  try {
    loadLocales(dir);
    return [];
  } catch (error) {
    if (error instanceof ContentError) return [...error.issues];
    throw error;
  }
}

describe('loadLocales', () => {
  it('loads a valid two-language set', () => {
    write('en/common.yaml', 'greeting: Hi\n');
    write('de/common.yaml', 'greeting: Hallo\n');

    const locales = loadLocales(dir);

    expect(locales).toEqual({
      en: { common: { greeting: 'Hi' } },
      de: { common: { greeting: 'Hallo' } },
    });
    expect(compareToReference(locales)).toEqual([]);
  });

  it('accepts i18next plural suffixes on text leaves and compares keys without them', () => {
    write('en/common.yaml', 'moves_one: "{{count}} move"\nmoves_other: "{{count}} moves"\n');
    // Polish-style plural forms differ from English; the base key is what must match.
    write('pl/common.yaml', 'moves_one: a\nmoves_few: b\nmoves_many: c\n');

    const locales = loadLocales(dir);

    expect(compareToReference(locales)).toEqual([]);
  });

  it('rejects a plural suffix on a map key and an unknown suffix', () => {
    write('en/common.yaml', 'group_one:\n  a: x\nmoves_lots: y\n');

    const issues = issuesOf();

    expect(issues).toContainEqual(expect.stringContaining('group_one: invalid key name'));
    expect(issues).toContainEqual(expect.stringContaining('moves_lots: invalid key name'));
  });

  it('rejects an invalid key name', () => {
    write('en/common.yaml', 'Bad_Key: Hi\n');

    expect(issuesOf()).toEqual(['en/common.yaml: Bad_Key: invalid key name']);
  });

  it('rejects an empty string leaf', () => {
    write('en/common.yaml', "greeting: ''\n");

    expect(issuesOf()).toEqual(['en/common.yaml: greeting: must be a non-empty string']);
  });

  it('rejects a number leaf', () => {
    write('en/common.yaml', 'count: 5\n');

    const issues = issuesOf();
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain('en/common.yaml: count');
    expect(issues[0]).toContain('must be a non-empty string');
  });

  it('rejects a duplicate key', () => {
    write('en/common.yaml', 'greeting: Hi\ngreeting: Bye\n');

    const issues = issuesOf();
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain('en/common.yaml');
    expect(issues[0]).toContain('YAML syntax error');
  });

  it('rejects a YAML syntax error', () => {
    write('en/common.yaml', 'greeting: [unclosed\n');

    const issues = issuesOf();
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain('en/common.yaml');
    expect(issues[0]).toContain('YAML syntax error');
  });

  it('rejects a bad language directory name', () => {
    write('English/common.yaml', 'greeting: Hi\n');

    expect(issuesOf()).toEqual(['English: invalid language directory name']);
  });

  it('rejects a stray non-yaml file', () => {
    write('en/common.yaml', 'greeting: Hi\n');
    write('en/notes.txt', 'not yaml\n');

    expect(issuesOf()).toEqual([
      'en/notes.txt: invalid file name (expected <namespace>.yaml, lowercase kebab-case)',
    ]);
  });

  it('reports a missing key in a second language', () => {
    write('en/common.yaml', 'greeting: Hi\nfarewell: Bye\n');
    write('de/common.yaml', 'greeting: Hallo\n');

    const locales = loadLocales(dir);

    expect(compareToReference(locales)).toEqual(['de/common.yaml: missing key farewell']);
  });

  it('reports an extra key in a second language', () => {
    write('en/common.yaml', 'greeting: Hi\n');
    write('de/common.yaml', 'greeting: Hallo\nfarewell: Tschuss\n');

    const locales = loadLocales(dir);

    expect(compareToReference(locales)).toEqual(['de/common.yaml: extra key farewell']);
  });

  it('reports a missing namespace in a second language', () => {
    write('en/common.yaml', 'greeting: Hi\n');
    write('en/home.yaml', 'title: Home\n');
    write('de/common.yaml', 'greeting: Hallo\n');

    const locales = loadLocales(dir);

    expect(compareToReference(locales)).toEqual(['de: missing namespace home']);
  });

  it('reports an extra namespace in a second language', () => {
    write('en/common.yaml', 'greeting: Hi\n');
    write('de/common.yaml', 'greeting: Hallo\n');
    write('de/home.yaml', 'title: Zuhause\n');

    const locales = loadLocales(dir);

    expect(compareToReference(locales)).toEqual(['de/home.yaml: extra namespace home']);
  });

  it('reports multiple issues across files together', () => {
    write('en/common.yaml', 'Bad_Key: Hi\n');
    write('en/home.yaml', 'count: 5\n');

    const issues = issuesOf();

    expect(issues).toHaveLength(2);
    expect(issues.some((issue) => issue.startsWith('en/common.yaml:'))).toBe(true);
    expect(issues.some((issue) => issue.startsWith('en/home.yaml:'))).toBe(true);
  });
});

describe('ContentError', () => {
  it('lists every issue in its message', () => {
    write('en/common.yaml', 'Bad_Key: Hi\n');
    write('en/home.yaml', 'count: 5\n');

    expect.assertions(4);
    try {
      loadLocales(dir);
    } catch (error) {
      expect(error).toBeInstanceOf(ContentError);
      const contentError = error as ContentError;
      expect(contentError.issues).toHaveLength(2);
      for (const issue of contentError.issues) {
        expect(contentError.message).toContain(issue);
      }
    }
  });
});
