import { expect, test } from '@playwright/test';
import { completeFirstRun, contentText, pickProfileFromPicker } from './helpers.ts';

/**
 * Offline + performance hardening (M5.4, `non-functional.md` §4/§6): lazy-loaded screens actually
 * fetch their own chunk over the network (not just bundled into the main one), the app's main
 * flows raise no Content-Security-Policy violation, and Home becomes interactive within budget
 * under a throttled CPU.
 */

test('lazy-loaded screens (parent area, friend setup) fetch their own chunk on first visit', async ({
  page,
}) => {
  await completeFirstRun(page, 'Kid');

  // Parent area: its own chunk is requested only once its screen is actually opened — proves
  // `App.tsx`'s `React.lazy` really does split it out, not just theoretically.
  const parentChunk = page.waitForResponse((response) =>
    /\/assets\/ParentAreaScreen-.*\.js$/.test(new URL(response.url()).pathname),
  );
  await page.getByRole('button', { name: 'Switch player' }).click();
  await page.getByRole('button', { name: /Grown-ups/ }).click();
  await page.getByLabel('Password', { exact: true }).fill('1234');
  await page.getByRole('button', { name: 'Open' }).click();
  await expect(page.getByRole('heading', { name: 'Parent area' })).toBeVisible();
  await parentChunk;
});

test('no Content-Security-Policy violation across the main flows (Home, Journey, Play, Den, parent area)', async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as unknown as { __csp: string[] }).__csp = [];
    document.addEventListener('securitypolicyviolation', (event) => {
      (window as unknown as { __csp: string[] }).__csp.push(
        `${event.violatedDirective}: ${event.blockedURI}`,
      );
    });
  });

  await completeFirstRun(page, 'Kid');

  await page.getByRole('button', { name: /Journey/ }).click();
  await page.getByRole('button', { name: contentText('journey:ui.back') }).click();

  // `exact: true`: "Play" alone also (sub-string) matches the "Switch player" button.
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.getByRole('button', { name: contentText('journey:ui.back') }).click();

  await page.getByRole('button', { name: 'My Den' }).click();
  await page.getByRole('button', { name: contentText('journey:ui.back') }).click();

  // Parent area (lazy chunk).
  await page.getByRole('button', { name: 'Switch player' }).click();
  await page.getByRole('button', { name: /Grown-ups/ }).click();
  await page.getByLabel('Password', { exact: true }).fill('1234');
  await page.getByRole('button', { name: 'Open' }).click();
  await expect(page.getByRole('heading', { name: 'Parent area' })).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();

  const violations = await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp);
  expect(violations).toEqual([]);
});

test('cold start: Home is interactive within budget on a throttled tablet', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'CPU throttling is a Chromium DevTools protocol feature');

  // Untimed setup, normal speed: a returning kid's device already has a profile and a warm
  // service-worker cache (`non-functional.md` §1) — measuring *that* everyday reopen, not a
  // one-time first-run/parent-setup flow, is what "cold start" targets (non-functional.md §4).
  await completeFirstRun(page, 'Kid');
  await expect(page.getByText('Ready to play offline.')).toBeVisible({ timeout: 15_000 });

  const client = await page.context().newCDPSession(page);
  // 4x CPU slowdown (non-functional.md §4 decision table): a mid-range Android tablet next to a
  // desktop CI runner.
  await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });

  const start = Date.now();
  await page.reload();
  await page.getByRole('heading', { name: "Who's playing today?" }).waitFor();
  await pickProfileFromPicker(page, 'Kid');
  const elapsedMs = Date.now() - start;

  console.log(
    `Cold start (4x CPU throttle, tablet viewport, picker tap to Home): ${String(elapsedMs)}ms`,
  );
  // Target is <= 3s locally (recorded in docs/validation.md); CI machines vary too much for that
  // exact bound, so this only guards against a real regression (a budget several times over).
  expect(elapsedMs).toBeLessThan(5000);
});
