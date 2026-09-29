import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Two projects: `node` (core, kinds, content) and `web` (jsdom: `*.test.tsx` and `src/web`).
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          exclude: ['**/node_modules/**', 'src/web/**'],
        },
      },
      {
        plugins: [react()],
        test: {
          name: 'web',
          environment: 'jsdom',
          include: ['src/**/*.test.tsx', 'src/web/**/*.test.ts'],
          exclude: ['**/node_modules/**'],
          testTimeout: 15_000,
        },
      },
    ],
  },
});
