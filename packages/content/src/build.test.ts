import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CompiledContent } from '@chess-kids/core';
import { beforeAll, describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';

const packageDir = join(dirname(fileURLToPath(import.meta.url)), '..');

beforeAll(() => {
  execFileSync(process.execPath, ['scripts/build.ts'], { cwd: packageDir });
});

describe('build script', () => {
  it('builds dist/locales/en.json from the real locales', () => {
    const output: unknown = JSON.parse(
      readFileSync(join(packageDir, 'dist', 'locales', 'en.json'), 'utf8'),
    );
    const readNamespace = (name: string): unknown =>
      parseYaml(readFileSync(join(packageDir, 'locales', 'en', `${name}.yaml`), 'utf8'));

    expect(output).toEqual({
      common: readNamespace('common'),
      lessons: readNamespace('lessons'),
      characters: readNamespace('characters'),
    });
  });

  it('builds dist/content.json matching CompiledContent, with the rook lesson first', () => {
    const content = JSON.parse(
      readFileSync(join(packageDir, 'dist', 'content.json'), 'utf8'),
    ) as CompiledContent;

    expect(content.version).toBe(1);
    expect(Array.isArray(content.lessons)).toBe(true);
    expect(Array.isArray(content.minigames)).toBe(true);
    expect(content.lessons[0]?.id).toBe('rook');
  });
});
