import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Separate from the app's vite.config.ts: the PWA plugin has no role in tests and slows them down.
// `*.slow.test.{ts,tsx}` stays excluded (m8.2 item 1's convention) even though this package has no
// `test:slow` script: the exclude is a no-op guard against a slow test landing in the default run.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['**/node_modules/**', 'src/**/*.slow.test.{ts,tsx}'],
    testTimeout: 15_000,
  },
});
