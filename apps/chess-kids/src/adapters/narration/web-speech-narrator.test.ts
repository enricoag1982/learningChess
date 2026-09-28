import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createWebSpeechNarrator } from './web-speech-narrator.ts';

/** Minimal `SpeechSynthesisUtterance` stand-in: jsdom does not implement the Web Speech API. */
class FakeUtterance extends EventTarget {
  readonly text: string;
  rate = 1;
  pitch = 1;
  voice: SpeechSynthesisVoice | null = null;
  constructor(text: string) {
    super();
    this.text = text;
  }
}

/** Minimal `SpeechSynthesis` stand-in, enough for the narrator adapter's needs. */
class FakeSpeechSynthesis extends EventTarget {
  voices: SpeechSynthesisVoice[] = [];
  spoken: FakeUtterance[] = [];
  cancelCalls = 0;

  getVoices(): SpeechSynthesisVoice[] {
    return this.voices;
  }

  speak(utterance: SpeechSynthesisUtterance): void {
    this.spoken.push(utterance);
  }

  cancel(): void {
    this.cancelCalls += 1;
  }
}

function makeVoice(overrides: Partial<SpeechSynthesisVoice>): SpeechSynthesisVoice {
  return {
    voiceURI: 'voice',
    name: 'Voice',
    lang: 'en-US',
    localService: false,
    default: false,
    ...overrides,
  };
}

const originalUtterance = globalThis.SpeechSynthesisUtterance;

beforeEach(() => {
  globalThis.SpeechSynthesisUtterance = FakeUtterance as unknown as typeof SpeechSynthesisUtterance;
});

afterEach(() => {
  globalThis.SpeechSynthesisUtterance = originalUtterance;
  vi.restoreAllMocks();
});

describe('createWebSpeechNarrator — unavailable', () => {
  it('is a silent no-op when Web Speech is missing', async () => {
    const narrator = createWebSpeechNarrator(undefined);

    expect(narrator.available).toBe(false);
    await expect(narrator.speak('hello')).resolves.toBeUndefined();
    expect(() => {
      narrator.cancel();
    }).not.toThrow();
  });
});

describe('createWebSpeechNarrator — available', () => {
  it('prefers an on-device (localService) English voice over other English voices', async () => {
    const synth = new FakeSpeechSynthesis();
    synth.voices = [
      makeVoice({ name: 'fr', lang: 'fr-FR', localService: true }),
      makeVoice({ name: 'en-GB', lang: 'en-GB', localService: false, default: false }),
      makeVoice({ name: 'en-US-local', lang: 'en-US', localService: true }),
      makeVoice({ name: 'en-AU-default', lang: 'en-AU', localService: false, default: true }),
    ];
    const narrator = createWebSpeechNarrator(synth as unknown as SpeechSynthesis);

    expect(narrator.available).toBe(true);
    const speaking = narrator.speak('Rhino says hi');
    const utterance = synth.spoken[0];
    expect(utterance?.voice?.name).toBe('en-US-local');
    utterance?.dispatchEvent(new Event('end'));
    await speaking;
  });

  it('falls back to the default English voice when no local-service voice is English', async () => {
    const synth = new FakeSpeechSynthesis();
    synth.voices = [
      makeVoice({ name: 'fr-local', lang: 'fr-FR', localService: true }),
      makeVoice({ name: 'en-default', lang: 'en-GB', localService: false, default: true }),
    ];
    const narrator = createWebSpeechNarrator(synth as unknown as SpeechSynthesis);

    const speaking = narrator.speak('hi');
    const utterance = synth.spoken[0];
    expect(utterance?.voice?.name).toBe('en-default');
    utterance?.dispatchEvent(new Event('end'));
    await speaking;
  });

  it('sets rate and pitch on the utterance', async () => {
    const synth = new FakeSpeechSynthesis();
    const narrator = createWebSpeechNarrator(synth as unknown as SpeechSynthesis);

    const speaking = narrator.speak('hi');
    const utterance = synth.spoken[0];
    expect(utterance?.rate).toBe(0.95);
    expect(utterance?.pitch).toBe(1.05);
    utterance?.dispatchEvent(new Event('end'));
    await speaking;
  });

  it('cancels anything already playing before speaking again', async () => {
    const synth = new FakeSpeechSynthesis();
    const narrator = createWebSpeechNarrator(synth as unknown as SpeechSynthesis);

    const first = narrator.speak('one');
    synth.spoken[0]?.dispatchEvent(new Event('end'));
    await first;
    const second = narrator.speak('two');
    synth.spoken[1]?.dispatchEvent(new Event('end'));
    await second;

    expect(synth.cancelCalls).toBe(2);
  });

  it('resolves (never rejects) when the utterance ends', async () => {
    const synth = new FakeSpeechSynthesis();
    const narrator = createWebSpeechNarrator(synth as unknown as SpeechSynthesis);

    const speaking = narrator.speak('hi');
    synth.spoken[0]?.dispatchEvent(new Event('end'));
    await expect(speaking).resolves.toBeUndefined();
  });

  it('resolves (never rejects) when the utterance errors', async () => {
    const synth = new FakeSpeechSynthesis();
    const narrator = createWebSpeechNarrator(synth as unknown as SpeechSynthesis);

    const speaking = narrator.speak('hi');
    synth.spoken[0]?.dispatchEvent(new Event('error'));
    await expect(speaking).resolves.toBeUndefined();
  });

  it('re-picks the voice when the browser fires voiceschanged', async () => {
    const synth = new FakeSpeechSynthesis();
    const narrator = createWebSpeechNarrator(synth as unknown as SpeechSynthesis);

    synth.voices = [makeVoice({ name: 'en-later', lang: 'en-US', localService: true })];
    synth.dispatchEvent(new Event('voiceschanged'));

    const speaking = narrator.speak('hi');
    const utterance = synth.spoken[0];
    expect(utterance?.voice?.name).toBe('en-later');
    utterance?.dispatchEvent(new Event('end'));
    await speaking;
  });

  it('works when SpeechSynthesis is not an EventTarget (Safari < 16, iPad mini 4 on iOS 15)', async () => {
    const synth = {
      voices: [] as SpeechSynthesisVoice[],
      spoken: [] as FakeUtterance[],
      onvoiceschanged: null as (() => void) | null,
      getVoices(): SpeechSynthesisVoice[] {
        return this.voices;
      },
      speak(utterance: FakeUtterance): void {
        this.spoken.push(utterance);
      },
      cancel(): void {
        // Nothing to stop.
      },
    };
    const narrator = createWebSpeechNarrator(synth as unknown as SpeechSynthesis);

    synth.voices = [makeVoice({ name: 'en-later', lang: 'en-US', localService: true })];
    synth.onvoiceschanged?.();

    const speaking = narrator.speak('hi');
    const utterance = synth.spoken[0];
    expect(utterance?.voice?.name).toBe('en-later');
    utterance?.dispatchEvent(new Event('end'));
    await speaking;
  });

  it('picks a voice at speak time when none was listed at startup and no event came', async () => {
    const synth = new FakeSpeechSynthesis();
    const narrator = createWebSpeechNarrator(synth as unknown as SpeechSynthesis);

    synth.voices = [makeVoice({ name: 'en-late', lang: 'en-US', localService: true })];

    const speaking = narrator.speak('hi');
    const utterance = synth.spoken[0];
    expect(utterance?.voice?.name).toBe('en-late');
    utterance?.dispatchEvent(new Event('end'));
    await speaking;
  });

  it('cancel() stops the underlying synthesis', () => {
    const synth = new FakeSpeechSynthesis();
    const narrator = createWebSpeechNarrator(synth as unknown as SpeechSynthesis);

    narrator.cancel();
    expect(synth.cancelCalls).toBe(1);
  });
});
