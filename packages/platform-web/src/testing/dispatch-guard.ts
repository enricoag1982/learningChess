// The CI guard behind "exercise-type / mini-game-mode dispatch stays in the registries" (docs/refactor-v4.md §4):
// one detector and one scan, called from each package's own test with its own literals.
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

export interface DispatchGuardOptions {
  readonly title: string;
  /** Offenders are reported relative to it. */
  readonly root: string;
  /** Absolute paths, usually from `listSourceFiles`. */
  readonly files: readonly string[];
  /** Every exercise type and mode id the package knows. */
  readonly literals: readonly string[];
  /** Root-relative files that may dispatch (the registries, narrowing guards). */
  readonly allowed?: readonly string[];
}

/** Every `.ts` / `.tsx` file under `dir`, tests excluded. */
export function listSourceFiles(dir: string): readonly string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listSourceFiles(full));
    } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/** True when `source` branches on one of `literals` (a `===` / `!==` comparison off a `.type` / `.mode` property, either
 * order, or a `switch` `case`). */
export function dispatchesOnTypeOrMode(source: string, literals: readonly string[]): boolean {
  const names = literals.map((literal) => literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const pattern = new RegExp(
    `\\.(type|mode)\\s*(===|!==)\\s*['"](${names})['"]` +
      `|['"](${names})['"]\\s*(===|!==)\\s*\\w+\\.(type|mode)` +
      `|case\\s*['"](${names})['"]\\s*:`,
  );
  return pattern.test(source);
}

/** Registers the scan (no file outside `allowed` dispatches on a literal) and the detector's own fixture test. */
export function dispatchGuard({
  title,
  root,
  files,
  literals,
  allowed = [],
}: DispatchGuardOptions): void {
  const literal = literals[0];
  if (literal === undefined) throw new Error('dispatchGuard: no literals to look for');
  const allowedFiles = new Set(allowed);

  describe(title, () => {
    it('finds no dispatch on a type/mode literal outside the allowed files', () => {
      const offenders = files
        .map((file) => path.relative(root, file).replaceAll('\\', '/'))
        .filter((rel) => !allowedFiles.has(rel))
        .filter((rel) =>
          dispatchesOnTypeOrMode(fs.readFileSync(path.join(root, rel), 'utf8'), literals),
        );
      expect(offenders).toEqual([]);
    });

    // Proves the detector itself works (string fixtures, never a real file): the scan above would stay green
    // even if it stopped detecting anything.
    it('the detector catches a deliberate type/mode dispatch fixture', () => {
      const detects = (source: string): boolean => dispatchesOnTypeOrMode(source, literals);
      expect(detects(`if (def.type === '${literal}') { help(); }`)).toBe(true);
      expect(detects(`if ('${literal}' !== def.type) { help(); }`)).toBe(true);
      expect(detects(`switch (game.mode) { case '${literal}': break; }`)).toBe(true);
      expect(detects(`const label = 'plays ${literal} the bot';`)).toBe(false);
      expect(detects(`hint.kind === '${literal}'`)).toBe(false);
    });
  });
}
