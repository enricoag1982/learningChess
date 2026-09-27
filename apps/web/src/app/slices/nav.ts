import type { Profile } from '@chess-kids/core';
import { isFirstRun, listProfiles } from '@chess-kids/core';
import type { AppGet, AppSet } from '../store.ts';
import type { RouteName } from '../routes.ts';
import { gated } from './time.ts';

export interface NavSlice {
  readonly screen: RouteName;
  /** Decides the first screen: first run, or the picker (app-structure.md §3). Call once at startup. */
  readonly init: () => Promise<void>;
  /** Opens the new-player wizard; `returnsToParent` when entered from the parent area's "Add child". */
  readonly startNewPlayer: (returnsToParent: boolean) => void;
  /** Refreshes the profiles list and shows the picker, last-used first. */
  readonly goToPicker: () => Promise<void>;
  /** Opens the Journey map. */
  readonly goToJourney: () => void;
  /** Journey's back button, Play's/Den's/Practice's back button. */
  readonly goToHome: () => void;
  /** Opens the Play screen. */
  readonly goToPlay: () => void;
  /** Opens My Den. */
  readonly goToDen: () => void;
  /** Opens the Practice screen. */
  readonly goToPractice: () => void;
}

/** Last-used profile first (docs/screens.md: picker shows it first), rest unchanged. */
function orderByLastUsed(profiles: readonly Profile[], lastProfileId: string | null): Profile[] {
  const ordered = [...profiles];
  if (lastProfileId === null) return ordered;
  const index = ordered.findIndex((profile) => profile.id === lastProfileId);
  if (index <= 0) return ordered;
  const [last] = ordered.splice(index, 1);
  if (last) ordered.unshift(last);
  return ordered;
}

/** `gated`, specialised to "returning to Home" (the gate's other checkpoint alongside entering
 * an activity — domain-model.md §3.3). Exported so `learn`/`today`/`play` share it. */
export async function goHomeGated(set: AppSet, get: AppGet): Promise<void> {
  await gated(set, get, () => {
    set({ screen: 'home' });
  });
}

export function createNavSlice(set: AppSet, get: AppGet): NavSlice {
  return {
    screen: 'loading',

    async init() {
      const { services } = get();
      if (await isFirstRun(services.deps)) {
        set({ screen: 'first-run' });
        return;
      }
      await get().goToPicker();
    },

    startNewPlayer(returnsToParent: boolean) {
      set({ screen: 'new-player', newPlayerReturnsToParent: returnsToParent });
    },

    async goToPicker() {
      const { services } = get();
      const [profiles, settings] = await Promise.all([
        listProfiles(services.deps),
        services.deps.settings.get(),
      ]);
      set({ profiles: orderByLastUsed(profiles, settings.lastProfileId), screen: 'picker' });
    },

    goToJourney() {
      set({ screen: 'journey' });
    },

    goToHome() {
      set({ levelUpSuggestion: null });
      void goHomeGated(set, get);
    },

    goToPlay() {
      set({ screen: 'play' });
    },

    goToDen() {
      set({ screen: 'den' });
    },

    goToPractice() {
      set({ screen: 'practice' });
    },
  };
}
