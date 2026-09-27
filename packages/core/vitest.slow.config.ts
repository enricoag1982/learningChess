import { defineConfig } from 'vitest/config';

// `pnpm test:slow` (CI `slow` job): only `*.slow.test.ts` (bot self-play, strength and timing
// budgets, deep perft). Files run one at a time so a timing budget never shares the CPU with the
// self-play test.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.slow.test.ts'],
    exclude: ['**/node_modules/**'],
    fileParallelism: false,
  },
});
