import { expect, test } from '@playwright/test';
import type { CompiledContent, TracksCatalog } from '@chess-kids/core';
import { nextLesson, voiceKey } from '@chess-kids/core';
import rawContent from '@chess-kids/content/content.json' with { type: 'json' };
import rawTracks from '@chess-kids/content/tracks.json' with { type: 'json' };
import { completeFirstRun, contentText, pickProfileFromPicker } from './helpers.ts';

const content = rawContent as unknown as CompiledContent;
const catalog = rawTracks as unknown as TracksCatalog;

/**
 * M6.2 (`docs/voice.md`): a text with generated audio plays it instead of Web Speech, and the same
 * audio still loads once the service worker's precache is the only source (offline). Uses the
 * first Journey lesson's Story text — whichever lesson that currently is (`nextLesson`, same as
 * `lesson.spec.ts`) — since every lesson story is inventoried (`voice-texts.test.ts`).
 */
test('first lesson story: plays generated audio, never Web Speech, and still loads offline', async ({
  page,
  context,
}) => {
  const lesson = nextLesson(catalog, content.lessons, []);
  if (!lesson) throw new Error('bundled content/tracks: no first lesson found');
  const storyText = contentText(lesson.storyKey);
  const expectedKey = voiceKey(storyText);

  // Patches the *existing* `speechSynthesis` object's own `speak` (not replaced wholesale) so it
  // still catches a call even though the app's own narrator captures its reference once, at
  // startup (`web-speech-narrator.ts`'s `createWebSpeechNarrator`) — before any app script runs.
  await page.addInitScript(() => {
    const w = window as unknown as { __speakCalls: string[] };
    w.__speakCalls = [];
    const synth = window.speechSynthesis as SpeechSynthesis | undefined;
    if (synth) {
      const original = synth.speak.bind(synth);
      synth.speak = (utterance: SpeechSynthesisUtterance) => {
        w.__speakCalls.push(utterance.text);
        original(utterance);
      };
    }
  });

  const audioRequests: string[] = [];
  page.on('request', (request) => {
    const url = request.url();
    if (url.includes('/audio/en/') && url.endsWith('.mp3')) audioRequests.push(url);
  });

  await completeFirstRun(page, 'Kid');
  // Service worker fully installed/precached (same readiness signal `offline.spec.ts` waits on).
  await expect(page.getByText('Ready to play offline.')).toBeVisible({ timeout: 15_000 });

  await page.getByRole('button', { name: /Start/ }).click(); // Home -> Story
  await expect(page.getByText(storyText)).toBeVisible();

  await expect
    .poll(() => audioRequests.some((url) => url.endsWith(`/${expectedKey}.mp3`)))
    .toBe(true);
  // Not asserting the whole page never called Web Speech: Home's own owl line (spoken on mount,
  // before "Start" is even clicked) may or may not have generated audio independently of the
  // story — this only asserts the *story* itself was never read by Web Speech.
  expect(
    await page.evaluate(() => (window as unknown as { __speakCalls: string[] }).__speakCalls),
  ).not.toContain(storyText);

  // Offline: the same story, reached the same way, still gets its generated audio — served from
  // the service worker's precache, not a live request — and still never falls back to Web Speech.
  audioRequests.length = 0;
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: "Who's playing today?" })).toBeVisible();
  await pickProfileFromPicker(page, 'Kid');
  await page.getByRole('button', { name: /Start/ }).click();
  await expect(page.getByText(storyText)).toBeVisible();

  await expect
    .poll(() => audioRequests.some((url) => url.endsWith(`/${expectedKey}.mp3`)))
    .toBe(true);
  expect(
    await page.evaluate(() => (window as unknown as { __speakCalls: string[] }).__speakCalls),
  ).not.toContain(storyText);
});
