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
        // `__APP_VERSION__` (each app's `vite.config.ts` `define`): the services stamp it.
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
