// CI guard: type / mode dispatch stays inside the pack's 4 registries. Scans `src/web` plus the UI files
// beside each kind / mode engine (`src/kinds/<type>/`, `src/modes/<mode>/`).
import path from 'node:path';
import { dispatchGuard, listSourceFiles } from '@learn/platform-web/testing/dispatch-guard.ts';

const EXERCISE_TYPES = [
  'collect-stars',
  'capture',
  'select-squares',
  'yes-no',
  'choice',
  'best-move',
  'setup',
  'mate-in-n',
];
const MODE_TYPES = ['static', 'series', 'versus'];

/** vs Friend / vs Computer accept only a `versus`-mode mini-game (the only mode with `rules` +
 * a live game to record) — a narrowing guard, not a per-mode dispatch; predates R3b. */
const ALLOWED_MODE_GUARDS = ['ui/FriendGameScreen.tsx', 'ui/FullGameScreen.tsx'];

const srcDir = import.meta.dirname;
const uiBesideEngines = ['kinds', 'modes'].flatMap((dir) =>
  listSourceFiles(path.join(srcDir, '..', dir)).filter((file) => /\.tsx$|[\\/]ui\.ts$/.test(file)),
);

dispatchGuard({
  title: 'subject-chess web: type / mode dispatch stays inside the 4 registries',
  root: srcDir,
  files: [...listSourceFiles(srcDir), ...uiBesideEngines],
  literals: [...EXERCISE_TYPES, ...MODE_TYPES],
  allowed: [
    'kinds/ui-registry.ts',
    'kinds/e2e-registry.ts',
    'modes/ui-registry.ts',
    'modes/e2e-registry.ts',
    ...ALLOWED_MODE_GUARDS,
  ],
});
