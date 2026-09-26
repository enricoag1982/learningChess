import { defineConfig } from 'vitest/config';

// `pnpm test` (default `vitest run`): fast unit tests only. `*.slow.test.ts` (winnability) is
// excluded here and run by `pnpm test:slow` (`vitest.slow.config.ts`) instead — m8.2 item 1, CI's
// `slow` job.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['**/node_modules/**', 'src/**/*.slow.test.ts'],
  },
});
