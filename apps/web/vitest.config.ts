import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// `__APP_VERSION__` (M5.5, `vite.config.ts`'s own `define`): vitest does not build through
// `vite.config.ts`, so it needs the same replacement here, or any test rendering the parent area
// throws a `ReferenceError`.
const { version } = JSON.parse(
  readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf-8'),
) as { version: string };

// Separate from vite.config.ts: the PWA plugin has no role in tests and slows them down.
// `*.slow.test.{ts,tsx}` stays excluded here (m8.2 item 1's `*.slow.test.ts` convention, used by
// core/content) even though this package has no `test:slow` script: no web test is slow enough to
// need one yet (no test here takes > 3s) — the exclude is just a no-op guard against one landing in
// the default `pnpm test` run by accident if that ever changes.
export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/testing/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['**/node_modules/**', 'src/**/*.slow.test.{ts,tsx}'],
    // Full-app RTL flows (a whole game, a mini-game run) take 3–5 s on a loaded machine; the 5 s
    // default timed them out under parallel load (v1.1.0 validation).
    testTimeout: 15_000,
  },
});
