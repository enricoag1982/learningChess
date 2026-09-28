import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CompiledContent } from '@learn/subject-chess';
import { beforeAll, describe, expect, it } from 'vitest';
import { mergeLocales } from './load.ts';
import type { LocaleTree } from './schema.ts';
import { parse as parseYaml } from 'yaml';

const packageDir = join(dirname(fileURLToPath(import.meta.url)), '..');

beforeAll(() => {
  execFileSync(process.execPath, ['scripts/build.ts'], { cwd: packageDir });
});

describe('build script', () => {
  it('builds dist/locales/en.json from the real (platform + chess) locales', () => {
    const output: unknown = JSON.parse(
      readFileSync(join(packageDir, 'dist', 'locales', 'en.json'), 'utf8'),
    );
    const readNamespace = (root: readonly string[], name: string): LocaleTree =>
      parseYaml(readFileSync(join(...root, 'en', `${name}.yaml`), 'utf8')) as LocaleTree;
    const platformDir = [packageDir, 'locales'];
    const chessDir = [packageDir, 'chess', 'locales'];
    const merged = mergeLocales(
      { en: { common: readNamespace(platformDir, 'common') } },
      { en: { common: readNamespace(chessDir, 'common') } },
    );

    expect(output).toEqual({
      common: merged.en?.common,
      lessons: readNamespace(chessDir, 'lessons'),
      characters: readNamespace(chessDir, 'characters'),
      journey: readNamespace(platformDir, 'journey'),
      rewards: readNamespace(platformDir, 'rewards'),
    });
  });

  it('builds dist/content.json matching CompiledContent, including the rook lesson', () => {
    const content = JSON.parse(
      readFileSync(join(packageDir, 'dist', 'content.json'), 'utf8'),
    ) as CompiledContent;

    expect(content.version).toBe(1);
    expect(Array.isArray(content.lessons)).toBe(true);
    expect(Array.isArray(content.minigames)).toBe(true);
    // Files are read in directory order (alphabetical), not curriculum order: check by id,
    // not position.
    expect(content.lessons.some((lesson) => lesson.id === 'rook')).toBe(true);
  });

  it('builds dist/badges.json with the 25-badge MVP catalogue', () => {
    const badges = JSON.parse(readFileSync(join(packageDir, 'dist', 'badges.json'), 'utf8')) as {
      readonly id: string;
    }[];

    expect(badges).toHaveLength(25);
    expect(badges.map((badge) => badge.id)).toContain('first-win');
  });
});
