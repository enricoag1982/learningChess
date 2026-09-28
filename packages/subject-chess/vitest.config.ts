import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// `pnpm test` (default `vitest run`): fast unit tests only. `*.slow.test.ts` (bot self-play /
// strength / timing, deep perft) is excluded here and run by `pnpm test:slow`
// (`vitest.slow.config.ts`) instead — m8.2 item 1, CI's `slow` job.
// Two projects: `node` (core, content, kind engines) and `web` (jsdom: `*.test.tsx` and `src/web`).
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          exclude: ['**/node_modules/**', 'src/**/*.slow.test.ts', 'src/web/**'],
        },
      },
      {
        // `__APP_VERSION__` (`apps/chess-kids/vite.config.ts`'s own `define`): the test services stamp it.
        define: { __APP_VERSION__: JSON.stringify('0.0.0-test') },
        plugins: [react()],
        test: {
          name: 'web',
          environment: 'jsdom',
          setupFiles: ['./vitest.web.setup.ts'],
          include: ['src/**/*.test.tsx', 'src/web/**/*.test.ts'],
          exclude: ['**/node_modules/**'],
          testTimeout: 15_000,
        },
      },
    ],
  },
});
