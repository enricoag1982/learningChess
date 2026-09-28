import { loadGameRecords } from '@learn/platform-core';
import { computerLevelStatus, updateSuggestedLevel } from '@learn/subject-chess';
import { backAndRefresh, type SliceCreator } from '../store.ts';

/** vs Friend's second player (`docs/app-structure.md` §6): another profile, or a guest (no password, no record). */
export type FriendOpponentChoice =
  { readonly kind: 'profile'; readonly profileId: string } | { readonly kind: 'guest' };

/** Board mode for a vs Friend match (`docs/app-structure.md` §6). */
export type FriendBoardMode = 'pass-and-play' | 'face-to-face';

/** The vs Friend setup sheet's current choices, and what the friend game screen reads once "Start" is tapped. */
export interface FriendSetupState {
  readonly opponent: FriendOpponentChoice | null;
  /** `'full'` for the full game, else a `versus` mini-game's content id. */
  readonly gameId: string | null;
  readonly boardMode: FriendBoardMode;
  readonly legalMoveDots: boolean;
  /** Active profile plays White by default; true swaps starting colours. */
  readonly swapColours: boolean;
}

/** Tablet landscape and up (docs/app-structure.md §6): face-to-face's own default board mode. */
const FACE_TO_FACE_MIN_WIDTH = 768;

/** `window.innerWidth`-based default board mode; never throws (SSR/test environments without `window`). */
function defaultFriendBoardMode(): FriendBoardMode {
  try {
    return window.innerWidth >= FACE_TO_FACE_MIN_WIDTH ? 'face-to-face' : 'pass-and-play';
  } catch {
    return 'pass-and-play';
  }
}

const DEFAULT_FRIEND_SETUP: FriendSetupState = {
  opponent: null,
  gameId: null,
  boardMode: 'pass-and-play',
  legalMoveDots: true,
  swapColours: false,
};

export interface PlaySlice {
  /** Owl's "Ready for the Fox?" line, set once a full game moves the suggested level up; cleared
   * on next read (`full-game` entry, `goToHome`) so it never lingers. */
  readonly levelUpSuggestion: { readonly level: number } | null;
  /** The vs Friend setup sheet's current choices, read by `friend-game` once "Start" is tapped. */
  readonly friendSetup: FriendSetupState;

  /** Play's vs Computer "Full game" button: opens a full game vs `level` (1 Mouse .. 5 Bear). */
  readonly startFullGame: (level: number) => void;
  /** Leaves the full-game screen back to Play, refreshing progress (game records included). */
  readonly exitFullGame: () => void;
  /** Recomputes the "Automatic level" suggestion (`docs/computer-opponent.md` §5) after a full
   * game at `level`; sets `levelUpSuggestion` when it moves up. */
  readonly updateAutomaticLevel: (level: number) => Promise<void>;
  /** Play's "vs Friend" card: opens the setup sheet, resetting its choices (board mode defaults
   * to face-to-face on a tablet-width screen, pass-and-play otherwise). */
  readonly goToFriendSetup: () => void;
  /** Merges `patch` into the setup sheet's current choices. */
  readonly updateFriendSetup: (patch: Partial<FriendSetupState>) => void;
  /** The setup sheet's "Start" button: opens the friend game screen (a no-op without both a
   * second player and a game picked, guarding a stale click). */
  readonly startFriendGame: () => void;
  /** Leaves the friend game screen back to Play, refreshing progress (game records included). */
  readonly exitFriendGame: () => void;
}

export const createPlaySlice: SliceCreator<PlaySlice> = (set, get) => {
  return {
    levelUpSuggestion: null,
    friendSetup: DEFAULT_FRIEND_SETUP,

    startFullGame: (level) =>
      void get().navigate({ name: 'full-game', level: level as 1 | 2 | 3 | 4 | 5 }),

    exitFullGame: backAndRefresh(get),

    async updateAutomaticLevel(level: number) {
      const { profile, journey, services } = get();
      if (!profile || !journey) return;
      const records = await loadGameRecords(services.deps, profile.id);
      const statuses = computerLevelStatus(records, journey);
      const update = await updateSuggestedLevel(
        services.deps,
        profile.id,
        level as 1 | 2 | 3 | 4 | 5,
        records,
        statuses,
      );
      if (update?.leveledUp) {
        set({ levelUpSuggestion: { level: update.level } });
      }
    },

    goToFriendSetup() {
      set({ friendSetup: { ...DEFAULT_FRIEND_SETUP, boardMode: defaultFriendBoardMode() } });
      void get().navigate({ name: 'friend-setup' });
    },

    updateFriendSetup: (patch) => {
      set((state) => ({ friendSetup: { ...state.friendSetup, ...patch } }));
    },

    startFriendGame() {
      const { friendSetup } = get();
      if (!friendSetup.opponent || !friendSetup.gameId) return;
      void get().navigate({ name: 'friend-game' });
    },

    exitFriendGame: backAndRefresh(get, 'play'),
  };
};
