import type { Narrator } from '@chess-kids/core';
import { voiceKey } from '@chess-kids/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAudioNarrator } from './audio-narrator.ts';

/** Minimal `AudioBufferSourceNode` stand-in: jsdom does not implement Web Audio. */
class FakeSourceNode {
  buffer: AudioBuffer | null = null;
  onended: (() => void) | null = null;
  connected = false;
  started = false;
  stopped = false;
  startThrows = false;

  connect(): void {
    this.connected = true;
  }

  start(): void {
    if (this.startThrows) throw new Error('cannot start');
    this.started = true;
  }

  stop(): void {
    this.stopped = true;
  }

  /** Simulates the browser firing `onended` once playback finishes (test-driven, not timer-based). */
  finish(): void {
    this.onended?.();
  }
}

/** Minimal `AudioContext` stand-in. `resumeFails`/initial `state` are set per test. */
class FakeAudioContext {
  state: AudioContextState = 'running';
  destination = {};
  resumeCalls = 0;
  resumeFails = false;
  decodeCalls = 0;
  decodeFails = false;
  sources: FakeSourceNode[] = [];

  resume(): Promise<void> {
    this.resumeCalls += 1;
    if (this.resumeFails) return Promise.reject(new Error('resume failed'));
    this.state = 'running';
    return Promise.resolve();
  }

  createBuffer(): AudioBuffer {
    return {} as AudioBuffer;
  }

  createBufferSource(): FakeSourceNode {
    const source = new FakeSourceNode();
    this.sources.push(source);
    return source;
  }

  decodeAudioData(): Promise<AudioBuffer> {
    this.decodeCalls += 1;
    if (this.decodeFails) return Promise.reject(new Error('bad mp3'));
    return Promise.resolve({ duration: 1 } as AudioBuffer);
  }
}

/** Records every `speak`/`cancel`; `speak` stays pending until the test calls `resolveNext()` or
 * `cancel()` is called on it (mirrors `createWebSpeechNarrator`'s own cancel-resolves-the-promise
 * behaviour). */
class FakeFallback implements Narrator {
  available = true;
  speakCalls: string[] = [];
  cancelCalls = 0;
  private pending: (() => void) | undefined;

  speak(text: string): Promise<void> {
    this.speakCalls.push(text);
    return new Promise((resolve) => {
      this.pending = resolve;
    });
  }

  cancel(): void {
    this.cancelCalls += 1;
    this.pending?.();
    this.pending = undefined;
  }

  resolveNext(): void {
    this.pending?.();
    this.pending = undefined;
  }
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function jsonResponse(body: unknown, ok = true): Response {
  return { ok, json: () => Promise.resolve(body) } as unknown as Response;
}

function bufferResponse(ok = true): Response {
  return { ok, arrayBuffer: () => Promise.resolve(new ArrayBuffer(4)) } as unknown as Response;
}

/** Fetch stand-in keyed by exact URL, each handler a function so a test can return a still-pending
 * promise (a `deferred()`) to control ordering. */
class FakeFetch {
  calls: string[] = [];
  private handlers = new Map<string, () => Promise<Response>>();

  on(url: string, handler: () => Promise<Response>): void {
    this.handlers.set(url, handler);
  }

  fn: typeof fetch = (input: RequestInfo | URL) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    this.calls.push(url);
    const handler = this.handlers.get(url);
    if (handler === undefined) return Promise.reject(new Error(`unexpected fetch: ${url}`));
    return handler();
  };
}

const BASE_URL = 'https://example.test/audio/en/';
const TEXT = 'Watch Rhino run to every green dot.';
const KEY = voiceKey(TEXT);

function manifestWith(...keys: string[]): Record<string, unknown> {
  return {
    config: {},
    entries: Object.fromEntries(keys.map((key) => [key, { text: key, ms: 1000 }])),
  };
}

let realAudioContext: typeof AudioContext | undefined;

beforeEach(() => {
  realAudioContext = (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext;
});

afterEach(() => {
  (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext = realAudioContext;
  vi.restoreAllMocks();
});

describe('createAudioNarrator', () => {
  it('hit: plays generated audio without touching the fallback', async () => {
    const ctx = new FakeAudioContext();
    const fetch = new FakeFetch();
    fetch.on(`${BASE_URL}manifest.json`, () => Promise.resolve(jsonResponse(manifestWith(KEY))));
    fetch.on(`${BASE_URL}${KEY}.mp3`, () => Promise.resolve(bufferResponse()));
    const fallback = new FakeFallback();
    const narrator = createAudioNarrator({
      baseUrl: BASE_URL,
      fallback,
      fetch: fetch.fn,
      audioContextFactory: () => ctx as unknown as AudioContext,
    });

    const speaking = narrator.speak(TEXT);
    await vi.waitFor(() => {
      expect(ctx.sources).toHaveLength(1);
    });
    expect(ctx.sources[0]?.started).toBe(true);
    expect(fallback.speakCalls).toEqual([]);

    ctx.sources[0]?.finish();
    await expect(speaking).resolves.toBeUndefined();
  });

  it('miss: falls back to Web Speech for a text with no manifest entry', async () => {
    const ctx = new FakeAudioContext();
    const fetch = new FakeFetch();
    fetch.on(`${BASE_URL}manifest.json`, () =>
      Promise.resolve(jsonResponse(manifestWith('other-key'))),
    );
    const fallback = new FakeFallback();
    const narrator = createAudioNarrator({
      baseUrl: BASE_URL,
      fallback,
      fetch: fetch.fn,
      audioContextFactory: () => ctx as unknown as AudioContext,
    });

    const speaking = narrator.speak(TEXT);
    await vi.waitFor(() => {
      expect(fallback.speakCalls).toEqual([TEXT]);
    });
    expect(ctx.sources).toHaveLength(0);

    fallback.resolveNext();
    await expect(speaking).resolves.toBeUndefined();
  });

  it('manifest load failure (network error) falls back to Web Speech', async () => {
    const ctx = new FakeAudioContext();
    const fetch = new FakeFetch();
    fetch.on(`${BASE_URL}manifest.json`, () => Promise.reject(new Error('offline')));
    const fallback = new FakeFallback();
    const narrator = createAudioNarrator({
      baseUrl: BASE_URL,
      fallback,
      fetch: fetch.fn,
      audioContextFactory: () => ctx as unknown as AudioContext,
    });

    const speaking = narrator.speak(TEXT);
    await vi.waitFor(() => {
      expect(fallback.speakCalls).toEqual([TEXT]);
    });
    fallback.resolveNext();
    await expect(speaking).resolves.toBeUndefined();
  });

  it('manifest load failure (404) falls back to Web Speech', async () => {
    const ctx = new FakeAudioContext();
    const fetch = new FakeFetch();
    fetch.on(`${BASE_URL}manifest.json`, () => Promise.resolve(jsonResponse(undefined, false)));
    const fallback = new FakeFallback();
    const narrator = createAudioNarrator({
      baseUrl: BASE_URL,
      fallback,
      fetch: fetch.fn,
      audioContextFactory: () => ctx as unknown as AudioContext,
    });

    const speaking = narrator.speak(TEXT);
    await vi.waitFor(() => {
      expect(fallback.speakCalls).toEqual([TEXT]);
    });
    fallback.resolveNext();
    await expect(speaking).resolves.toBeUndefined();
  });

  it('decode error falls back to Web Speech', async () => {
    const ctx = new FakeAudioContext();
    ctx.decodeFails = true;
    const fetch = new FakeFetch();
    fetch.on(`${BASE_URL}manifest.json`, () => Promise.resolve(jsonResponse(manifestWith(KEY))));
    fetch.on(`${BASE_URL}${KEY}.mp3`, () => Promise.resolve(bufferResponse()));
    const fallback = new FakeFallback();
    const narrator = createAudioNarrator({
      baseUrl: BASE_URL,
      fallback,
      fetch: fetch.fn,
      audioContextFactory: () => ctx as unknown as AudioContext,
    });

    const speaking = narrator.speak(TEXT);
    await vi.waitFor(() => {
      expect(fallback.speakCalls).toEqual([TEXT]);
    });
    fallback.resolveNext();
    await expect(speaking).resolves.toBeUndefined();
  });

  it('no AudioContext available falls back to Web Speech', async () => {
    const fallback = new FakeFallback();
    const narrator = createAudioNarrator({
      baseUrl: BASE_URL,
      fallback,
      fetch: () => Promise.reject(new Error('should not be called')),
      audioContextFactory: () => {
        throw new Error('no AudioContext');
      },
    });

    const speaking = narrator.speak(TEXT);
    await vi.waitFor(() => {
      expect(fallback.speakCalls).toEqual([TEXT]);
    });
    fallback.resolveNext();
    await expect(speaking).resolves.toBeUndefined();
    expect(narrator.available).toBe(true); // fallback.available still makes the narrator available
  });

  it('a still-suspended AudioContext falls back when resume() fails', async () => {
    const ctx = new FakeAudioContext();
    ctx.state = 'suspended';
    ctx.resumeFails = true;
    const fetch = new FakeFetch();
    fetch.on(`${BASE_URL}manifest.json`, () => Promise.resolve(jsonResponse(manifestWith(KEY))));
    const fallback = new FakeFallback();
    const narrator = createAudioNarrator({
      baseUrl: BASE_URL,
      fallback,
      fetch: fetch.fn,
      audioContextFactory: () => ctx as unknown as AudioContext,
    });

    const speaking = narrator.speak(TEXT);
    await vi.waitFor(() => {
      expect(fallback.speakCalls).toEqual([TEXT]);
    });
    expect(ctx.resumeCalls).toBe(1);
    fallback.resolveNext();
    await expect(speaking).resolves.toBeUndefined();
  });

  it('cancel() stops in-flight audio playback and the fallback', async () => {
    const ctx = new FakeAudioContext();
    const fetch = new FakeFetch();
    fetch.on(`${BASE_URL}manifest.json`, () => Promise.resolve(jsonResponse(manifestWith(KEY))));
    fetch.on(`${BASE_URL}${KEY}.mp3`, () => Promise.resolve(bufferResponse()));
    const fallback = new FakeFallback();
    const narrator = createAudioNarrator({
      baseUrl: BASE_URL,
      fallback,
      fetch: fetch.fn,
      audioContextFactory: () => ctx as unknown as AudioContext,
    });

    const speaking = narrator.speak(TEXT);
    await vi.waitFor(() => {
      expect(ctx.sources).toHaveLength(1);
    });
    expect(ctx.sources[0]?.started).toBe(true);

    const cancelCallsBeforeExplicitCancel = fallback.cancelCalls; // speak() itself cancels defensively first
    narrator.cancel();
    expect(ctx.sources[0]?.stopped).toBe(true);
    expect(fallback.cancelCalls).toBe(cancelCallsBeforeExplicitCancel + 1);
    // The real `ended` event never fires once `stop()` has been called this way (nothing else
    // resolves it) — `cancel()` itself must still settle the pending `speak()` promise.
    await expect(speaking).resolves.toBeUndefined();
  });

  it('cancel() also stops a fallback that is currently speaking', async () => {
    const ctx = new FakeAudioContext();
    const fetch = new FakeFetch();
    fetch.on(`${BASE_URL}manifest.json`, () =>
      Promise.resolve(jsonResponse(manifestWith('other-key'))),
    );
    const fallback = new FakeFallback();
    const narrator = createAudioNarrator({
      baseUrl: BASE_URL,
      fallback,
      fetch: fetch.fn,
      audioContextFactory: () => ctx as unknown as AudioContext,
    });

    const speaking = narrator.speak(TEXT);
    await vi.waitFor(() => {
      expect(fallback.speakCalls).toEqual([TEXT]);
    });

    const cancelCallsBeforeExplicitCancel = fallback.cancelCalls; // speak() itself cancels defensively first
    narrator.cancel();
    expect(fallback.cancelCalls).toBe(cancelCallsBeforeExplicitCancel + 1);
    await expect(speaking).resolves.toBeUndefined();
  });

  it('a stale speak() is ignored once a newer speak() has started', async () => {
    const ctx = new FakeAudioContext();
    const fetch = new FakeFetch();
    const firstManifest = deferred<Response>();
    fetch.on(`${BASE_URL}manifest.json`, () => firstManifest.promise);
    const fallback = new FakeFallback();
    const narrator = createAudioNarrator({
      baseUrl: BASE_URL,
      fallback,
      fetch: fetch.fn,
      audioContextFactory: () => ctx as unknown as AudioContext,
    });

    // First speak() starts, but its manifest fetch never resolves until we say so below.
    const first = narrator.speak('first text');
    await vi.waitFor(() => {
      expect(fetch.calls).toContain(`${BASE_URL}manifest.json`);
    });

    // A second, newer speak() supersedes it before the first's manifest fetch settles.
    const secondKey = voiceKey('second text');
    fetch.on(`${BASE_URL}${secondKey}.mp3`, () => Promise.resolve(bufferResponse()));
    firstManifest.resolve(jsonResponse(manifestWith(secondKey))); // now let both continue
    const second = narrator.speak('second text');

    await vi.waitFor(() => {
      expect(ctx.sources).toHaveLength(1);
    });
    // Only the second text's audio ever plays; the stale first `speak()` never called the fallback
    // or played anything once superseded.
    expect(fallback.speakCalls).toEqual([]);
    ctx.sources[0]?.finish();

    await expect(first).resolves.toBeUndefined();
    await expect(second).resolves.toBeUndefined();
  });

  it('a newer speak() while audio is actively playing still resolves the superseded speak()', async () => {
    const ctx = new FakeAudioContext();
    const fetch = new FakeFetch();
    fetch.on(`${BASE_URL}manifest.json`, () => Promise.resolve(jsonResponse(manifestWith(KEY))));
    fetch.on(`${BASE_URL}${KEY}.mp3`, () => Promise.resolve(bufferResponse()));
    const fallback = new FakeFallback();
    const narrator = createAudioNarrator({
      baseUrl: BASE_URL,
      fallback,
      fetch: fetch.fn,
      audioContextFactory: () => ctx as unknown as AudioContext,
    });

    const first = narrator.speak(TEXT); // hit: starts playing real audio
    await vi.waitFor(() => {
      expect(ctx.sources).toHaveLength(1);
    });
    expect(ctx.sources[0]?.started).toBe(true);

    fetch.on(`${BASE_URL}other-key.mp3`, () => Promise.resolve(bufferResponse()));
    const second = narrator.speak('second text'); // supersedes the first mid-playback

    // The first source is stopped (never fires its own `ended`), yet `first` still settles —
    // this is exactly the bug a plain `source.stop()` with no explicit resolve would hang on.
    expect(ctx.sources[0]?.stopped).toBe(true);
    await expect(first).resolves.toBeUndefined();
    void second; // its own manifest miss (no 'second text' entry) resolves independently
  });

  it('nickname: stripped before the lookup key, but the original text still reaches the fallback', async () => {
    const ctx = new FakeAudioContext();
    const strippedKey = voiceKey('Great job!');
    const fetch = new FakeFetch();
    fetch.on(`${BASE_URL}manifest.json`, () =>
      Promise.resolve(jsonResponse(manifestWith(strippedKey))),
    );
    fetch.on(`${BASE_URL}${strippedKey}.mp3`, () => Promise.resolve(bufferResponse()));
    const fallback = new FakeFallback();
    const narrator = createAudioNarrator({
      baseUrl: BASE_URL,
      fallback,
      fetch: fetch.fn,
      audioContextFactory: () => ctx as unknown as AudioContext,
    });
    narrator.setNickname('Mia');

    const speaking = narrator.speak('Great job, Mia!');
    await vi.waitFor(() => {
      expect(ctx.sources).toHaveLength(1);
    });
    expect(fallback.speakCalls).toEqual([]); // hit, once the nickname is stripped
    ctx.sources[0]?.finish();
    await expect(speaking).resolves.toBeUndefined();
  });

  it('nickname: a miss still passes the fallback the original text (with the name)', async () => {
    const ctx = new FakeAudioContext();
    const fetch = new FakeFetch();
    fetch.on(`${BASE_URL}manifest.json`, () =>
      Promise.resolve(jsonResponse(manifestWith('unrelated'))),
    );
    const fallback = new FakeFallback();
    const narrator = createAudioNarrator({
      baseUrl: BASE_URL,
      fallback,
      fetch: fetch.fn,
      audioContextFactory: () => ctx as unknown as AudioContext,
    });
    narrator.setNickname('Mia');

    const speaking = narrator.speak('Great job, Mia!');
    await vi.waitFor(() => {
      expect(fallback.speakCalls).toEqual(['Great job, Mia!']);
    });
    fallback.resolveNext();
    await expect(speaking).resolves.toBeUndefined();
  });

  it('reuses a decoded buffer from cache on a second hit for the same key (no second fetch of the mp3)', async () => {
    const ctx = new FakeAudioContext();
    const fetch = new FakeFetch();
    fetch.on(`${BASE_URL}manifest.json`, () => Promise.resolve(jsonResponse(manifestWith(KEY))));
    fetch.on(`${BASE_URL}${KEY}.mp3`, () => Promise.resolve(bufferResponse()));
    const fallback = new FakeFallback();
    const narrator = createAudioNarrator({
      baseUrl: BASE_URL,
      fallback,
      fetch: fetch.fn,
      audioContextFactory: () => ctx as unknown as AudioContext,
    });

    const first = narrator.speak(TEXT);
    await vi.waitFor(() => {
      expect(ctx.sources).toHaveLength(1);
    });
    ctx.sources[0]?.finish();
    await first;

    const mp3FetchesAfterFirst = fetch.calls.filter((url) => url.endsWith('.mp3')).length;
    const second = narrator.speak(TEXT);
    await vi.waitFor(() => {
      expect(ctx.sources).toHaveLength(2);
    });
    ctx.sources[1]?.finish();
    await second;

    const mp3FetchesAfterSecond = fetch.calls.filter((url) => url.endsWith('.mp3')).length;
    expect(mp3FetchesAfterSecond).toBe(mp3FetchesAfterFirst);
    expect(ctx.decodeCalls).toBe(1);
  });
});
