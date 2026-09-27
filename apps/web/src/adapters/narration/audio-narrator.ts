import type { Narrator } from '@chess-kids/core';
import { stripNickname, voiceKey } from '@chess-kids/core';

export interface CreateAudioNarratorOptions {
  /** e.g. `import.meta.env.BASE_URL + 'audio/en/'` — every file this adapter fetches is `<baseUrl><key>.mp3`/`<baseUrl>manifest.json`. */
  readonly baseUrl: string;
  /** Web Speech (or another `Narrator`), used for any text with no generated audio, or when audio playback itself is unavailable/fails. */
  readonly fallback: Narrator;
  /** Injectable `fetch` (tests). Defaults to the global `fetch`. */
  readonly fetch?: typeof fetch;
  /** Injectable `AudioContext` constructor (tests; also where a `webkitAudioContext` shim would go). Defaults to `window.AudioContext`. */
  readonly audioContextFactory?: () => AudioContext;
}

/** Why a `speak()` call fell back to the device voice instead of playing generated audio — the same
 * cases `docs/voice.md` "Fallback rules" lists, one id per case. */
export type AudioNarratorFallbackReason =
  | 'no-audio-context'
  | 'still-suspended'
  | 'manifest-not-loaded'
  | 'no-generated-audio'
  | 'file-missing'
  | 'decode-failed';

/** The outcome of one `speak()` call: generated audio actually played, or it fell back and why. */
export type AudioNarratorOutcome =
  | { readonly kind: 'audio' }
  | { readonly kind: 'fallback'; readonly reason: AudioNarratorFallbackReason };

export interface AudioNarrator extends Narrator {
  /** The active profile's nickname (or `null`), stripped from text before the generated-audio
   * lookup, same as the content inventory strips it from templates (`stripNickname`). */
  setNickname(nickname: string | null): void;
  /** The outcome of the most recently *completed* `speak()` call, or `null` before any has
   * finished — read by the parent area's "Test voice" check right after its own `speak()`. */
  lastOutcome(): AudioNarratorOutcome | null;
}

/** Decoded-buffer cache size (docs/voice.md): enough to cover one lesson/screen's worth of
 * repeats (replay button, a few exercises in a row) without holding the whole language in memory. */
const BUFFER_CACHE_SIZE = 20;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function hasAudioContextSupport(): boolean {
  const w = window as unknown as { AudioContext?: unknown; webkitAudioContext?: unknown };
  return typeof w.AudioContext === 'function' || typeof w.webkitAudioContext === 'function';
}

/** `localStorage` key for the missed-text report (`docs/voice.md`): off by default, a plain read. */
const VOICE_REPORT_STORAGE_KEY = 'chess-kids:voice-report';

function voiceReportEnabled(): boolean {
  try {
    return window.localStorage.getItem(VOICE_REPORT_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/** Records a text that fell back for a content reason (manifest miss, decode failure — not an
 * environmental one) while `voiceReportEnabled()`; the e2e a11y walk asserts this list stays empty. */
function recordVoiceMiss(text: string): void {
  if (!voiceReportEnabled()) return;
  const w = window as unknown as { __chessKidsVoiceMisses?: string[] };
  w.__chessKidsVoiceMisses ??= [];
  w.__chessKidsVoiceMisses.push(text);
}

function defaultAudioContextFactory(): AudioContext {
  const w = window as unknown as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  const Ctor = w.AudioContext ?? w.webkitAudioContext;
  if (Ctor === undefined) {
    throw new Error('AudioContext unavailable');
  }
  return new Ctor();
}

/** `Narrator` over pre-generated Kokoro audio (`docs/voice.md`), falling back to `fallback` (Web
 * Speech) for any text without generated audio or when playback itself cannot go ahead. */
export function createAudioNarrator(options: CreateAudioNarratorOptions): AudioNarrator {
  const { baseUrl, fallback } = options;
  const fetchFn = options.fetch ?? fetch;
  const audioContextFactory = options.audioContextFactory ?? defaultAudioContextFactory;

  let nickname: string | null = null;
  let audioContext: AudioContext | undefined;
  let unlockListenersAdded = false;
  let currentSource: AudioBufferSourceNode | undefined;
  /** Resolves the in-flight `playBuffer` promise for `currentSource`; stopping a node fires no
   * `onended`, so `stopCurrentSource` calls this itself or `cancel()` mid-playback would hang. */
  let currentResolve: (() => void) | undefined;
  /** Bumped by every `speak`/`cancel`; an in-flight async step whose captured token no longer
   * matches this one was superseded and must not play audio or resolve on its own. */
  let token = 0;

  const bufferCache = new Map<string, AudioBuffer>();
  let manifestKeysPromise: Promise<ReadonlySet<string> | null> | undefined;

  function cacheGet(key: string): AudioBuffer | undefined {
    const value = bufferCache.get(key);
    if (value !== undefined) {
      // Re-insert to mark most-recently-used (Map iteration order = insertion order).
      bufferCache.delete(key);
      bufferCache.set(key, value);
    }
    return value;
  }

  function cacheSet(key: string, value: AudioBuffer): void {
    bufferCache.delete(key);
    bufferCache.set(key, value);
    if (bufferCache.size > BUFFER_CACHE_SIZE) {
      const oldestKey = bufferCache.keys().next().value;
      if (oldestKey !== undefined) bufferCache.delete(oldestKey);
    }
  }

  function stopCurrentSource(): void {
    const source = currentSource;
    const resolve = currentResolve;
    currentSource = undefined;
    currentResolve = undefined;
    if (source === undefined) return;
    source.onended = null;
    try {
      source.stop();
    } catch {
      // Already stopped/ended — nothing to do.
    }
    resolve?.();
  }

  /** iOS Safari only unlocks Web Audio inside a `touchend`/`click` handler, never
   * `touchstart`/`pointerdown` — all four stay registered until `ctx.state` is really `'running'`. */
  const UNLOCK_EVENTS = ['pointerdown', 'touchend', 'click', 'keydown'] as const;

  /** iOS starts every `AudioContext` `suspended` until a gesture resumes it; this plays a 1-sample
   * silent buffer on the next one (the standard "unlock" trick) so a later `speak` is already allowed. */
  function ensureUnlockListener(ctx: AudioContext): void {
    if (unlockListenersAdded) return;
    unlockListenersAdded = true;

    function removeUnlockListeners(): void {
      for (const type of UNLOCK_EVENTS) {
        document.removeEventListener(type, unlock);
      }
    }

    function unlock(): void {
      ctx
        .resume()
        .then(() => {
          if (ctx.state === 'running') {
            removeUnlockListeners();
          }
        })
        .catch(() => {
          // Still suspended: keep listening for the next gesture (below), same as a rejection.
        });
      try {
        const silent = ctx.createBuffer(1, 1, ctx.sampleRate);
        const source = ctx.createBufferSource();
        source.buffer = silent;
        source.connect(ctx.destination);
        source.start(0);
      } catch {
        // Best-effort unlock only; a real `speak` later still gets its own resume attempt.
      }
    }

    for (const type of UNLOCK_EVENTS) {
      document.addEventListener(type, unlock);
    }
  }

  function getAudioContext(): AudioContext | null {
    if (audioContext !== undefined) return audioContext;
    try {
      audioContext = audioContextFactory();
    } catch {
      return null;
    }
    ensureUnlockListener(audioContext);
    return audioContext;
  }

  /** `ensureRunning`'s own cap on `ctx.resume()`: some iOS versions never settle it before the
   * unlock gesture lands, and this must not hang narration — the unlock listener stays registered. */
  const RESUME_TIMEOUT_MS = 300;

  function timeout<T>(ms: number, value: T): Promise<T> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(value);
      }, ms);
    });
  }

  /** Races `ctx.resume()` against `RESUME_TIMEOUT_MS` for a still-`suspended` context (e.g. the
   * very first narrated line, before any tap unlocked it); still suspended means this call falls back. */
  async function ensureRunning(ctx: AudioContext): Promise<boolean> {
    if (ctx.state !== 'suspended') return true;
    const resumed = await Promise.race([
      ctx
        .resume()
        .then(() => true)
        .catch(() => false),
      timeout(RESUME_TIMEOUT_MS, false),
    ]);
    if (!resumed) return false;
    return (ctx.state as AudioContextState) !== 'suspended';
  }

  /** Fetches `<baseUrl>manifest.json`'s `entries` keys (which texts have generated audio); `null`
   * (missing/unreachable/malformed) falls every `speak` back to Web Speech, same as one miss. */
  function loadManifestKeys(): Promise<ReadonlySet<string> | null> {
    return fetchFn(`${baseUrl}manifest.json`)
      .then((response) => (response.ok ? (response.json() as Promise<unknown>) : null))
      .then((data) => {
        if (!isRecord(data)) return null;
        const entries = data.entries;
        if (!isRecord(entries)) return null;
        return new Set(Object.keys(entries));
      })
      .catch(() => null);
  }

  function ensureManifestKeys(): Promise<ReadonlySet<string> | null> {
    manifestKeysPromise ??= loadManifestKeys();
    return manifestKeysPromise;
  }

  /** Fetch and decode are two separate failure cases so `lastOutcome()` can say which happened. */
  type BufferResult =
    { readonly buffer: AudioBuffer } | { readonly reason: 'file-missing' | 'decode-failed' };

  async function getOrDecodeBuffer(ctx: AudioContext, key: string): Promise<BufferResult> {
    const cached = cacheGet(key);
    if (cached !== undefined) return { buffer: cached };

    let response: Response;
    try {
      response = await fetchFn(`${baseUrl}${key}.mp3`);
    } catch {
      return { reason: 'file-missing' };
    }
    if (!response.ok) return { reason: 'file-missing' };

    let arrayBuffer: ArrayBuffer;
    try {
      arrayBuffer = await response.arrayBuffer();
    } catch {
      return { reason: 'file-missing' };
    }

    try {
      const buffer = await ctx.decodeAudioData(arrayBuffer);
      cacheSet(key, buffer);
      return { buffer };
    } catch {
      return { reason: 'decode-failed' };
    }
  }

  function playBuffer(ctx: AudioContext, buffer: AudioBuffer, myToken: number): Promise<void> {
    return new Promise((resolve) => {
      if (myToken !== token) {
        resolve();
        return;
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      currentSource = source;
      currentResolve = resolve;
      source.onended = () => {
        if (currentSource === source) {
          currentSource = undefined;
          currentResolve = undefined;
        }
        resolve();
      };
      try {
        source.start();
      } catch {
        if (currentSource === source) {
          currentSource = undefined;
          currentResolve = undefined;
        }
        resolve();
      }
    });
  }

  /** The most recently *completed* `doSpeak`'s outcome, read by `lastOutcome()`; only ever written
   * right before a still-current call's own branch, so a superseded call can't overwrite it. */
  let lastOutcomeValue: AudioNarratorOutcome | null = null;

  async function doSpeak(text: string, myToken: number): Promise<void> {
    // Nickname-stripped for the lookup key; a Web Speech fallback gets the original text instead,
    // since it has no such limitation and should still say the child's name.
    const key = voiceKey(stripNickname(text, nickname));

    const ctx = getAudioContext();
    if (ctx === null) {
      lastOutcomeValue = { kind: 'fallback', reason: 'no-audio-context' };
      return fallback.speak(text);
    }

    if (ctx.state === 'suspended') {
      const running = await ensureRunning(ctx);
      if (myToken !== token) return;
      if (!running) {
        lastOutcomeValue = { kind: 'fallback', reason: 'still-suspended' };
        return fallback.speak(text);
      }
    }

    const keys = await ensureManifestKeys();
    if (myToken !== token) return;
    if (keys === null) {
      lastOutcomeValue = { kind: 'fallback', reason: 'manifest-not-loaded' };
      return fallback.speak(text);
    }
    if (!keys.has(key)) {
      lastOutcomeValue = { kind: 'fallback', reason: 'no-generated-audio' };
      recordVoiceMiss(text);
      return fallback.speak(text);
    }

    const result = await getOrDecodeBuffer(ctx, key);
    if (myToken !== token) return;
    if ('reason' in result) {
      lastOutcomeValue = { kind: 'fallback', reason: result.reason };
      if (result.reason === 'decode-failed') recordVoiceMiss(text);
      return fallback.speak(text);
    }

    lastOutcomeValue = { kind: 'audio' };
    return playBuffer(ctx, result.buffer, myToken);
  }

  return {
    get available(): boolean {
      return hasAudioContextSupport() || fallback.available;
    },

    speak(text: string): Promise<void> {
      // Blank text: nothing to say, and nothing to interrupt (never inventoried, never a miss).
      if (text.trim() === '') return Promise.resolve();
      token += 1;
      const myToken = token;
      stopCurrentSource();
      fallback.cancel();
      return doSpeak(text, myToken);
    },

    cancel(): void {
      token += 1;
      stopCurrentSource();
      fallback.cancel();
    },

    setNickname(next: string | null): void {
      nickname = next;
    },

    lastOutcome(): AudioNarratorOutcome | null {
      return lastOutcomeValue;
    },
  };
}
