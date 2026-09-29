// CI guard: type / mode dispatch stays inside the pack's 3 registries. Scans `src/web` plus the UI files
// beside each kind (`src/kinds/<type>/`).
import path from 'node:path';
import { dispatchGuard, listSourceFiles } from '@learn/platform-web/testing/dispatch-guard.ts';

const srcDir = import.meta.dirname;
const uiBesideKinds = listSourceFiles(path.join(srcDir, '..', 'kinds')).filter((file) =>
  /\.tsx$|[\\/]ui\.ts$/.test(file),
);

dispatchGuard({
  title: 'subject-math web: type / mode dispatch stays inside the 3 registries',
  root: srcDir,
  files: [...listSourceFiles(srcDir), ...uiBesideKinds],
  literals: ['choice', 'number-entry', 'series'],
  allowed: ['kinds/ui-registry.ts', 'kinds/e2e-registry.ts', 'modes/e2e-registry.ts'],
});
