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
export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
