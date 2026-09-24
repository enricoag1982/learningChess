import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';

const packageDir = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('build script', () => {
  it('builds dist/locales/en.json from the real locales', () => {
    execFileSync(process.execPath, ['scripts/build.ts'], { cwd: packageDir });

    const output: unknown = JSON.parse(
      readFileSync(join(packageDir, 'dist', 'locales', 'en.json'), 'utf8'),
    );
    const source: unknown = parseYaml(
      readFileSync(join(packageDir, 'locales', 'en', 'common.yaml'), 'utf8'),
    );

    expect(output).toEqual({ common: source });
  });
});
