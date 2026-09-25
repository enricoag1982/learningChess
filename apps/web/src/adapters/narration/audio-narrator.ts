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

export interface AudioNarrator extends Narrator {
  /** The active profile's nickname (or `null` for none) — stripped from text before the
   * generated-audio lookup, same as `packages/content`'s inventory strips it from templates
   * (`voice-text.ts`'s `stripNickname`). Wired wherever the active profile is set, alongside
   * `Services.setVoiceEnabled` (`app/services.ts` / `store.ts`). */
  setNickname(nickname: string | null): void;
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

  /** iOS Safari (and some other mobile browsers) start every `AudioContext` `suspended` until a
   * user gesture resumes it. A one-time document listener on the very first tap/key resumes it and
   * plays a 1-sample silent buffer — the standard "unlock" trick — so by the time a lesson actually
   * wants to narrate, playback is already allowed. */
  function ensureUnlockListener(ctx: AudioContext): void {
    if (unlockListenersAdded) return;
    unlockListenersAdded = true;

    const unlock = (): void => {
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
      void ctx.resume().catch(() => {
        // Best-effort: `speak` itself retries `resume()` before falling back.
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
    };
    document.addEventListener('pointerdown', unlock, { once: true });
    document.addEventListener('keydown', unlock, { once: true });
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

  /** `speak` runs this when the context is still `suspended` (unlock listener above hasn't fired
   * yet, e.g. this is the very first narrated line and it plays before any tap/key). */
  async function ensureRunning(ctx: AudioContext): Promise<boolean> {
    if (ctx.state !== 'suspended') return true;
    try {
      await ctx.resume();
    } catch {
      return false;
    }
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

  async function getOrDecodeBuffer(ctx: AudioContext, key: string): Promise<AudioBuffer | null> {
    const cached = cacheGet(key);
    if (cached !== undefined) return cached;
    try {
      const response = await fetchFn(`${baseUrl}${key}.mp3`);
      if (!response.ok) return null;
      const arrayBuffer = await response.arrayBuffer();
      const buffer = await ctx.decodeAudioData(arrayBuffer);
      cacheSet(key, buffer);
      return buffer;
    } catch {
      return null;
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

  async function doSpeak(text: string, myToken: number): Promise<void> {
    // The lookup key is computed from the nickname-stripped text (never-in-audio rule), but a
    // fallback to Web Speech gets the *original* text — Web Speech has no such limitation, and
    // saying the child's name is the pre-M6 behaviour subtitles already promise it matches.
    const key = voiceKey(stripNickname(text, nickname));

    const ctx = getAudioContext();
    if (ctx === null) {
      return fallback.speak(text);
    }

    if (ctx.state === 'suspended') {
      const running = await ensureRunning(ctx);
      if (myToken !== token) return;
      if (!running) {
        return fallback.speak(text);
      }
    }

    const keys = await ensureManifestKeys();
    if (myToken !== token) return;
    if (keys === null || !keys.has(key)) {
      return fallback.speak(text);
    }

    const buffer = await getOrDecodeBuffer(ctx, key);
    if (myToken !== token) return;
    if (buffer === null) {
      return fallback.speak(text);
    }

    return playBuffer(ctx, buffer, myToken);
  }

  return {
    get available(): boolean {
      return hasAudioContextSupport() || fallback.available;
    },

    speak(text: string): Promise<void> {
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
  };
}
