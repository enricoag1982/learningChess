import { defineConfig } from 'vitest/config';

// `pnpm test:slow` (m8.2 item 1, CI's `slow` job): only `*.slow.test.ts` (winnability) —
// everything `vitest.config.ts`'s default `pnpm test` excludes.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.slow.test.ts'],
    exclude: ['**/node_modules/**'],
  },
});
