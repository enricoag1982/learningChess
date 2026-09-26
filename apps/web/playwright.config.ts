import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PW_PORT ?? 4173);
const baseURL = `http://localhost:${String(PORT)}`;

// Runs against the production build (`pnpm build && pnpm test:e2e`), never the dev server.
export default defineConfig({
  testDir: 'e2e',
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    // Sandbox chromium is preinstalled here; CI installs its own and leaves this unset.
    ...(process.env.PW_CHROMIUM_PATH
      ? { launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } }
      : {}),
  },
  webServer: {
    command: `pnpm exec vite preview --port ${String(PORT)} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: /fit\.spec\.ts/ },
    {
      name: 'tablet',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1024, height: 768 },
        hasTouch: true,
      },
      testIgnore: /fit\.spec\.ts/,
    },
    // Layout checks (accessibility + kid touch-target sizes) on the stacked layouts.
    {
      name: 'tablet-portrait',
      testMatch: /a11y\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 }, hasTouch: true },
    },
    // Also runs `fit.spec.ts` (phone-width stacked layout).
    {
      name: 'phone',
      testMatch: /a11y\.spec\.ts|fit\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, hasTouch: true },
    },
    // iPad mini 4 fit (owner report, iOS 15.8 Safari, 2026-09-26): viewport = Safari's VISIBLE
    // area — status 20 + address bar 50 + tab bar 0–36 px off 1024x768 → 918–954 portrait (900
    // used), 662–698 landscape (660 used). Chromium has no toolbar quirk.
    {
      name: 'ipad-mini-portrait',
      testMatch: /fit\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 900 }, hasTouch: true },
    },
    {
      name: 'ipad-mini-landscape',
      testMatch: /fit\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1024, height: 660 }, hasTouch: true },
    },
  ],
});
