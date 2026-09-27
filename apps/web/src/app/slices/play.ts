import { computerLevelStatus, loadGameRecords, updateSuggestedLevel } from '@chess-kids/core';
import type { AppGet, AppSet } from '../store.ts';

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
  /** Owl's "Ready for the Fox?" line (`docs/computer-opponent.md` §5 "Automatic level"), set once
   * a just-finished full game moves the profile's suggested level up; `null` otherwise. Play reads
   * it once (`ROUTE_ENTER` on `full-game`, and `goToHome`, clear it so it never lingers past the
   * game it is about). */
  readonly levelUpSuggestion: { readonly level: number } | null;
  /** The vs Friend setup sheet's current choices (screen `friend-setup`), read by the friend game
   * screen (`friend-game`) once "Start" is tapped. */
  readonly friendSetup: FriendSetupState;

  /**
   * Opens a mini-game's standalone session: from the Play screen (unlocked tiles only) or the
   * Journey map's world boss node — pushed on top of whichever, so `exitMiniGame`'s plain `back()`
   * returns to it unaided. A Today session's world-boss / mini-game activity opens the same screen
   * via `enterTodayActivity` instead, with the route's own `today` flag.
   */
  readonly startMiniGame: (miniGameId: string) => void;
  /**
   * Leaves the standalone mini-game session for wherever it was opened from; a Today-session
   * mini-game (the current route's `today` flag) abandons the whole session instead (`leaveToday`).
   */
  readonly exitMiniGame: () => void;
  /** Play's vs Computer "Full game" button: opens a full game vs `level` (1 Mouse .. 5 Bear). */
  readonly startFullGame: (level: number) => void;
  /** Leaves the full-game screen back to Play, refreshing progress (game records included). */
  readonly exitFullGame: () => void;
  /**
   * Recomputes and persists the "Automatic level" suggestion (`docs/computer-opponent.md` §5)
   * after one full game vs computer at `level` is recorded (finished or left — an abandoned game
   * never counts toward the last-5 tally itself, so this is a no-op either way for those). Sets
   * `levelUpSuggestion` when it moves the suggestion up a level. Called by `FullGameScreen` right
   * after its own `recordGame`.
   */
  readonly updateAutomaticLevel: (level: number) => Promise<void>;
  /** Play's "vs Friend" card: opens the setup sheet, resetting its choices (board mode defaults
   * to face-to-face on a tablet-width screen, pass-and-play otherwise). */
  readonly goToFriendSetup: () => void;
  /** Merges `patch` into the setup sheet's current choices. */
  readonly updateFriendSetup: (patch: Partial<FriendSetupState>) => void;
  /** The setup sheet's "Start" button: opens the friend game screen with the sheet's current
   * choices (a no-op without both a second player and a game picked — the button is disabled by
   * then, this guards a stale click). */
  readonly startFriendGame: () => void;
  /** Leaves the friend game screen back to Play, refreshing progress (game records included). */
  readonly exitFriendGame: () => void;
}

export function createPlaySlice(set: AppSet, get: AppGet): PlaySlice {
  return {
    levelUpSuggestion: null,
    friendSetup: DEFAULT_FRIEND_SETUP,

    startMiniGame(miniGameId: string) {
      void get().navigate({ name: 'minigame', miniGameId });
    },

    exitMiniGame() {
      const top = get().stack[get().stack.length - 1];
      if (top?.name === 'minigame' && top.today) {
        get().leaveToday();
      } else {
        void get().back();
      }
      void get().refreshProgress();
    },

    startFullGame(level: number) {
      void get().navigate({ name: 'full-game', level: level as 1 | 2 | 3 | 4 | 5 });
    },

    exitFullGame() {
      void get().back();
      void get().refreshProgress();
    },

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

    updateFriendSetup(patch: Partial<FriendSetupState>) {
      set((state) => ({ friendSetup: { ...state.friendSetup, ...patch } }));
    },

    startFriendGame() {
      const { friendSetup } = get();
      if (!friendSetup.opponent || !friendSetup.gameId) return;
      void get().navigate({ name: 'friend-game' });
    },

    exitFriendGame() {
      void get().back('play');
      void get().refreshProgress();
    },
  };
}
