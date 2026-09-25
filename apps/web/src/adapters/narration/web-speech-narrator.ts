import type { Narrator } from '@chess-kids/core';

/** Speaking rate and pitch tuned for a slow, friendly read-aloud voice. */
const RATE = 0.95;
const PITCH = 1.05;

/** `speechSynthesis` if the browser implements it (jsdom and older browsers do not). */
function browserSpeechSynthesis(): SpeechSynthesis | undefined {
  return 'speechSynthesis' in window ? window.speechSynthesis : undefined;
}

/** Best available voice: an on-device (offline) English voice, else any English voice. */
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

/**
 * `Narrator` over the Web Speech API. Prefers an on-device English voice (works offline); falls
 * back to a silent no-op narrator when Web Speech is unavailable (subtitles carry the text then).
 */
export function createWebSpeechNarrator(speech?: SpeechSynthesis): Narrator {
  const synth = speech ?? browserSpeechSynthesis();
  if (synth === undefined) {
    return silentNarrator;
  }

  let voice = pickVoice(synth.getVoices());
  const refreshVoice = (): void => {
    voice = pickVoice(synth.getVoices());
  };
  // Safari < 16 (iPad mini 4, iOS 15): `SpeechSynthesis` is not an `EventTarget` — calling
  // `addEventListener` threw at startup and left a blank page. The event-handler property is
  // harmless there, and `speak` re-picks a voice if none was found yet.
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
