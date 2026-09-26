import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Mirrors `vitest.config.ts`'s own `__APP_VERSION__` replacement (see its comment) in case a future
// `*.slow.test.tsx` renders the parent area.
const { version } = JSON.parse(
  readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf-8'),
) as { version: string };

// `pnpm test:slow` (m8.2 item 1, CI's `slow` job): only `*.slow.test.{ts,tsx}` — none authored yet
// (`--passWithNoTests` in the package script), so this file's job is to exist for when one is.
export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.slow.test.{ts,tsx}'],
    exclude: ['**/node_modules/**'],
    testTimeout: 15_000,
  },
});
