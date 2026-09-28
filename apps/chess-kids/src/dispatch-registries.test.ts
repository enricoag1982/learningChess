// CI guard (docs/refactor-v4.md §4): exercise-`type` / mini-game-`mode` dispatch stays inside the
// 4 registries (kinds/ui-registry.ts, kinds/e2e-registry.ts, modes/ui-registry.ts,
// modes/e2e-registry.ts) — everything else reads through `kindOf`/`kindUiOf`/`modeOf`/… instead.
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const EXERCISE_TYPES = [
  'collect-stars',
  'capture',
  'select-squares',
  'yes-no',
  'choice',
  'best-move',
  'setup',
  'mate-in-n',
] as const;
const MODE_TYPES = ['static', 'series', 'versus'] as const;

const ALLOWED_REGISTRIES = new Set([
  'kinds/ui-registry.ts',
  'kinds/e2e-registry.ts',
  'modes/ui-registry.ts',
  'modes/e2e-registry.ts',
]);

/** vs Friend / vs Computer accept only a `versus`-mode mini-game (the only mode with `rules` +
 * a live game to record) — a narrowing guard, not a per-mode dispatch; predates R3b. */
const ALLOWED_MODE_GUARDS = new Set(['ui/FriendGameScreen.tsx', 'ui/FullGameScreen.tsx']);

const LITERALS = [...EXERCISE_TYPES, ...MODE_TYPES].join('|');
const DISPATCH_PATTERN = new RegExp(
  `\\.(type|mode)\\s*(===|!==)\\s*['"](${LITERALS})['"]` +
    `|['"](${LITERALS})['"]\\s*(===|!==)\\s*\\w+\\.(type|mode)` +
    `|case\\s*['"](${LITERALS})['"]\\s*:`,
);

/** True when `source` branches on an exercise `type` / mini-game `mode` string literal (a
 * `===`/`!==` comparison off a `.type`/`.mode` property, either order, or a `switch` `case`). */
export function dispatchesOnTypeOrMode(source: string): boolean {
  return DISPATCH_PATTERN.test(source);
}

function listSourceFiles(dir: string): readonly string[] {
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

describe('exercise-type / mini-game-mode dispatch stays inside the 4 registries', () => {
  it('finds no dispatch on a type/mode literal outside them (or an allowed narrowing guard)', () => {
    const srcDir = import.meta.dirname;
    const offenders = listSourceFiles(srcDir)
      .map((file) => path.relative(srcDir, file).replaceAll('\\', '/'))
      .filter((rel) => !ALLOWED_REGISTRIES.has(rel) && !ALLOWED_MODE_GUARDS.has(rel))
      .filter((rel) => dispatchesOnTypeOrMode(fs.readFileSync(path.join(srcDir, rel), 'utf8')));
    expect(offenders).toEqual([]);
  });

  // Proves the detector itself works (a string fixture, never a real file) — the rule above would
  // stay green even if it stopped detecting anything, without this.
  it('the detector catches a deliberate type/mode dispatch fixture', () => {
    expect(dispatchesOnTypeOrMode(`if (def.type === 'yes-no') { help(); }`)).toBe(true);
    expect(dispatchesOnTypeOrMode(`switch (game.mode) { case 'versus': break; }`)).toBe(true);
    expect(dispatchesOnTypeOrMode(`const label = 'plays versus the bot';`)).toBe(false);
    expect(dispatchesOnTypeOrMode(`hint.kind === 'yes-no'`)).toBe(false);
  });
});
