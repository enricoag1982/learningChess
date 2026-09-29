import type { Narrator } from '@learn/platform-core';

/** Speaking rate and pitch tuned for a slow, friendly read-aloud voice. */
const RATE = 0.95;
const PITCH = 1.05;

function browserSpeechSynthesis(): SpeechSynthesis | undefined {
  return 'speechSynthesis' in window ? window.speechSynthesis : undefined;
}

function pickVoice(voices: readonly SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  const english = voices.filter((voice) => voice.lang.toLowerCase().startsWith('en'));
  return (
    english.find((voice) => voice.localService) ??
    english.find((voice) => voice.default) ??
    english[0]
  );
}

const silentNarrator: Narrator = {
  available: false,
  speak: () => Promise.resolve(),
  cancel: () => {
    // Nothing is ever playing.
  },
};

/** Prefers an on-device English voice; a silent no-op narrator when Web Speech is unavailable. */
export function createWebSpeechNarrator(speech?: SpeechSynthesis): Narrator {
  const synth = speech ?? browserSpeechSynthesis();
  if (synth === undefined) {
    return silentNarrator;
  }

  let voice = pickVoice(synth.getVoices());
  const refreshVoice = (): void => {
    voice = pickVoice(synth.getVoices());
  };
  // Safari < 16 (iOS 15): `SpeechSynthesis` is not an `EventTarget` — `addEventListener` threw at
  // startup and left a blank page; the event-handler property is harmless there.
  const events = synth as Partial<Pick<EventTarget, 'addEventListener'>> & {
    onvoiceschanged?: (() => void) | null;
  };
  if (typeof events.addEventListener === 'function') {
    events.addEventListener('voiceschanged', refreshVoice);
  } else {
    events.onvoiceschanged = refreshVoice;
  }

  return {
    available: true,

    speak(text: string): Promise<void> {
      synth.cancel();
      return new Promise((resolve) => {
        voice ??= pickVoice(synth.getVoices());
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = RATE;
        utterance.pitch = PITCH;
        if (voice !== undefined) {
          utterance.voice = voice;
        }
        const finish = (): void => {
          resolve();
        };
        utterance.addEventListener('end', finish);
        utterance.addEventListener('error', finish);
        synth.speak(utterance);
      });
    },

    cancel(): void {
      synth.cancel();
    },
  };
}
