import { defineConfig } from '@playwright/test';
import type { PlaywrightTestConfig } from '@playwright/test';

export interface E2EOptions {
  /** Default preview port; `PW_PORT` overrides it. */
  readonly port: number;
  readonly projects: PlaywrightTestConfig['projects'];
}

/** Runs against the production build (`vite preview`), never the dev server. */
export function defineE2EConfig({ port, projects }: E2EOptions): PlaywrightTestConfig {
  const previewPort = Number(process.env.PW_PORT ?? port);
  const baseURL = `http://localhost:${String(previewPort)}`;
  return defineConfig({
    testDir: 'e2e',
    forbidOnly: !!process.env.CI,
    retries: 0,
    reporter: [['list'], ['html', { open: 'never' }]],
    use: {
      baseURL,
      // A preinstalled sandbox chromium; CI installs its own and leaves this unset.
      ...(process.env.PW_CHROMIUM_PATH
        ? { launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } }
        : {}),
    },
    webServer: {
      command: `pnpm exec vite preview --port ${String(previewPort)} --strictPort`,
      url: baseURL,
      reuseExistingServer: !process.env.CI,
    },
    projects,
  });
}
