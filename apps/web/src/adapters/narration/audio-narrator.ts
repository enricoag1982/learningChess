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
  /** The active profile's nickname (or `null` for none) — stripped from text before the
   * generated-audio lookup, same as `packages/content`'s inventory strips it from templates
   * (`voice-text.ts`'s `stripNickname`). Wired wherever the active profile is set, alongside
   * `Services.setVoiceEnabled` (`app/services.ts` / `store.ts`). */
  setNickname(nickname: string | null): void;
  /** The outcome of the most recently *completed* `speak()` call, or `null` before any call has
   * finished. Read by the parent area's "Test voice" check (M6.3 item 2, `ChildSettings.tsx`) right
   * after awaiting its own `speak()` — nothing else in the app needs this. */
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

/** `localStorage` key for the missed-text report (M6.3 item 4, `docs/voice.md`): off by default
 * (a plain read, no other cost), so this never runs in a real kid's session. */
const VOICE_REPORT_STORAGE_KEY = 'chess-kids:voice-report';

function voiceReportEnabled(): boolean {
  try {
    return window.localStorage.getItem(VOICE_REPORT_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Records a text that fell back for a content reason (a manifest miss, or its mp3 not decoding) —
 * not an environmental one (no `AudioContext`, still suspended, manifest itself unreachable) — into
 * `window.__chessKidsVoiceMisses`, only while `voiceReportEnabled()`. The e2e a11y curriculum walk
 * (`e2e/a11y.spec.ts`) sets the flag and asserts this list is empty at the end: every narrated text
 * the walk reaches should have had generated audio.
 */
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

/**
 * `Narrator` over pre-generated Kokoro audio (`docs/voice.md`), with `fallback` (Web Speech) for
 * any text without generated audio, or when audio playback itself cannot go ahead (manifest
 * missing/unreachable, no `AudioContext`, fetch/decode error, or a still-locked `AudioContext` on
 * iOS — see the module doc comment above `speak` for the exact fallback triggers).
 */
export function createAudioNarrator(options: CreateAudioNarratorOptions): AudioNarrator {
  const { baseUrl, fallback } = options;
  const fetchFn = options.fetch ?? fetch;
  const audioContextFactory = options.audioContextFactory ?? defaultAudioContextFactory;

  let nickname: string | null = null;
  let audioContext: AudioContext | undefined;
  let unlockListenersAdded = false;
  let currentSource: AudioBufferSourceNode | undefined;
  /** Resolves the in-flight `playBuffer` promise for `currentSource` — `stopCurrentSource` calls
   * this itself (after nulling `onended`, so the real `ended` event never double-resolves it),
   * since stopping a node does not otherwise fire `onended`. Without this, `cancel()` mid-playback
   * would stop the audio but leave that `speak()` call's promise pending forever, breaking the
   * "resolves when playback ends or is cancelled" contract. */
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

  /** Every gesture type an unlock is attempted on. iOS Safari only actually unlocks Web Audio
   * inside a `touchend`/`click` handler — never `touchstart`/`pointerdown` — so all four are
   * listened on and the listeners stay registered (not `{ once: true }`) until `ctx.state` really
   * is `'running'`: a `pointerdown` (or an unlucky `touchend`) can fire the handler without
   * actually unlocking anything, and the next gesture (e.g. the `touchend` that follows the very
   * same tap's `pointerdown`) needs its own chance. */
  const UNLOCK_EVENTS = ['pointerdown', 'touchend', 'click', 'keydown'] as const;

  /** iOS Safari (and some other mobile browsers) start every `AudioContext` `suspended` until a
   * user gesture resumes it. A document listener on the next several gesture types resumes it and
   * plays a 1-sample silent buffer — the standard "unlock" trick — so by the time a lesson actually
   * wants to narrate, playback is already allowed. */
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

  /** How long `ensureRunning` waits on `ctx.resume()` before giving up on it for *this* `speak()`
   * call only — a `resume()` that never settles (seen on some iOS versions before the unlock
   * gesture has actually landed) must not hang narration indefinitely; the first-tap unlock
   * listener above stays registered regardless, so a later call still gets a running context. */
  const RESUME_TIMEOUT_MS = 300;

  function timeout<T>(ms: number, value: T): Promise<T> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(value);
      }, ms);
    });
  }

  /** `speak` runs this when the context is still `suspended` (unlock listener above hasn't fired
   * yet, e.g. this is the very first narrated line and it plays before any tap/key). Races
   * `ctx.resume()` against `RESUME_TIMEOUT_MS`: still suspended once that timer wins means this one
   * call falls back, without waiting on a `resume()` that may never settle. */
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

  /** `packages/content/dist/voice-texts.json` → `tools/voice/generate.py` → the manifest at
   * `<baseUrl>manifest.json` (`{ config, entries: { <key>: { text, ms } } }`). Only `entries`' keys
   * matter at runtime — a lookup table of which texts have generated audio; `text`/`ms`/`config`
   * are for `docs/voice.md`'s own tooling. `null` (missing/unreachable/malformed) means every
   * `speak` falls back to Web Speech, same as an individual miss. */
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

  /** Fetching the mp3 and decoding it are kept as two separate failure cases (`'file-missing'` vs
   * `'decode-failed'`) so `lastOutcome()` (M6.3 item 2) can tell a parent which one happened. */
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

  /** The outcome of the most recently *completed* `doSpeak` — read by `lastOutcome()` (M6.3 item
   * 2). Only ever written right before a branch a still-current call is about to take, so a
   * superseded call never overwrites a newer one's outcome with its own stale result. */
  let lastOutcomeValue: AudioNarratorOutcome | null = null;

  async function doSpeak(text: string, myToken: number): Promise<void> {
    // The lookup key is computed from the nickname-stripped text (never-in-audio rule), but a
    // fallback to Web Speech gets the *original* text — Web Speech has no such limitation, and
    // saying the child's name is the pre-M6 behaviour subtitles already promise it matches.
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
