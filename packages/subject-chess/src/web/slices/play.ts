import { loadGameRecords } from '@learn/platform-core';
import { computerLevelStatus, updateSuggestedLevel } from '../../chess.ts';
import { backAndRefresh, type SliceCreator } from '@learn/platform-web/app/store.ts';

/** vs Friend's second player (`docs/app-structure.md` §6): another profile, or a guest (no password, no record). */
export type FriendOpponentChoice =
  { readonly kind: 'profile'; readonly profileId: string } | { readonly kind: 'guest' };

export type FriendBoardMode = 'pass-and-play' | 'face-to-face';

export interface FriendSetupState {
  readonly opponent: FriendOpponentChoice | null;
  readonly gameId: string | null;
  readonly boardMode: FriendBoardMode;
  readonly legalMoveDots: boolean;
  /** Active profile plays White by default; true swaps starting colours. */
  readonly swapColours: boolean;
}

/** Tablet landscape and up (docs/app-structure.md §6): face-to-face's own default board mode. */
const FACE_TO_FACE_MIN_WIDTH = 768;

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
  readonly friendSetup: FriendSetupState;

  readonly startFullGame: (level: number) => void;
  readonly exitFullGame: () => void;
  /** Recomputes the "Automatic level" suggestion (`docs/computer-opponent.md` §5) after a full game at `level`; sets `levelUpSuggestion` when it moves up. */
  readonly updateAutomaticLevel: (level: number) => Promise<void>;
  /** Play's "vs Friend" card: opens the setup sheet, resetting its choices (board mode defaults
   * to face-to-face on a tablet-width screen, pass-and-play otherwise). */
  readonly goToFriendSetup: () => void;
  readonly updateFriendSetup: (patch: Partial<FriendSetupState>) => void;
  /** The setup sheet's "Start" button: opens the friend game screen (a no-op without both a
   * second player and a game picked, guarding a stale click). */
  readonly startFriendGame: () => void;
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
