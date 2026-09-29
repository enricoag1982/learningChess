import { devices } from '@playwright/test';
import { defineE2EConfig } from '@learn/platform-web/build/e2e-config.ts';

export default defineE2EConfig({
  port: 4174,
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
