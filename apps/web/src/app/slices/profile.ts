import type {
  ConceptStats,
  EarnedBadge,
  GameRecord,
  Journey,
  LessonProgress,
  MiniGameProgress,
  Profile,
  ProfileSettings,
  Streak,
} from '@chess-kids/core';
import {
  createProfile,
  DEFAULT_PROFILE_SETTINGS,
  getProfileSettings,
  listProfiles,
  loadGameRecords,
  loadJourney,
  loadMiniGameProgress,
  loadProgress,
  selectProfile,
} from '@chess-kids/core';
import { requestPersistentStorageIfNeeded } from '../../adapters/persistent-storage.ts';
import type { AppGet, AppSet } from '../store.ts';
import { loadRewards } from './rewards.ts';

export interface ProfileSlice {
  /** Every profile on this device (picker tiles, parent area's children list). */
  readonly profiles: readonly Profile[];
  /** The kid currently playing (Home / Lesson); `null` outside those screens. */
  readonly profile: Profile | null;
  /** `profile`'s own parent-set settings (app-structure.md §11), loaded alongside it —
   * `ExerciseStep`'s Hint button and `PlayScreen`'s computer-level default both read this;
   * `DEFAULT_PROFILE_SETTINGS` outside a selected profile. Voice is applied as a side effect at
   * load time (`services.setVoiceEnabled`), not read from here (`gated-narrator.ts` owns it). */
  readonly activeProfileSettings: ProfileSettings;
  readonly progress: readonly LessonProgress[];
  /** This profile's standalone mini-game progress (Play screen's best-stars tiles). */
  readonly miniGameProgress: readonly MiniGameProgress[];
  /** This profile's full-game / versus mini-game records (Play's vs Computer tally, My Den). */
  readonly gameRecords: readonly GameRecord[];
  /** This profile's concept mastery + review state (Leitner scheduler): Home's "Start today"
   * button and the Practice screen's due count / weak tags both read this. */
  readonly conceptStats: readonly ConceptStats[];
  /** This profile's Journey (tracks/worlds/lesson statuses/next lesson/rank); `null` until loaded. */
  readonly journey: Journey | null;

  /** First run only: after the "Saved" screen, either straight to the new-player wizard, straight to
   * Home (a single existing profile — the M1-upgrade path), or the picker (more than one). */
  readonly finishFirstRun: () => Promise<void>;
  /** New-player wizard's last step: creates the profile, then Home or back to the parent area. */
  readonly finishNewPlayer: (nickname: string, avatar: string) => Promise<void>;
  /** Picker: selects a profile, loads its progress, and goes to Home. */
  readonly selectProfileAndHome: (profileId: string) => Promise<void>;
  /** Re-reads the profiles list without changing screen (parent area, after rename/avatar/delete/add). */
  readonly refreshProfiles: () => Promise<void>;
  /**
   * Re-reads saved progress (lesson + mini-game) and the derived Journey from storage, e.g. after
   * a lesson or a standalone mini-game session updates it.
   */
  readonly refreshProgress: () => Promise<void>;
}

/** The per-profile data `activateProfile`/`refreshProgress` load and apply together. */
interface ProfileData {
  readonly progress: readonly LessonProgress[];
  readonly miniGameProgress: readonly MiniGameProgress[];
  readonly gameRecords: readonly GameRecord[];
  readonly conceptStats: readonly ConceptStats[];
  readonly journey: Journey | null;
  readonly earnedBadges: readonly EarnedBadge[];
  readonly streak: Streak | null;
}

/** One profile's progress/journey/rewards, loaded in parallel — the shared read behind
 * `activateProfile` and `refreshProgress`. */
async function loadProfileData(get: AppGet, profileId: string): Promise<ProfileData> {
  const { services } = get();
  const [progress, miniGameProgress, gameRecords, conceptStats, journey, rewards] =
    await Promise.all([
      loadProgress(services.deps, profileId),
      loadMiniGameProgress(services.deps, profileId),
      loadGameRecords(services.deps, profileId),
      services.deps.progress.listConceptStats(profileId),
      loadJourney(services.deps, profileId),
      loadRewards(get, profileId),
    ]);
  return {
    progress,
    miniGameProgress,
    gameRecords,
    conceptStats,
    journey,
    earnedBadges: rewards.earnedBadges,
    streak: rewards.streak ?? null,
  };
}

/**
 * Makes `profile` the one playing — the one profile-load path shared by the M1-upgrade path
 * (`finishFirstRun`), `finishNewPlayer`, and `selectProfileAndHome` (previously 4 near-identical
 * copies): applies `settings`'s voice/nickname side effects (app-structure.md §11 "Settings effect
 * now"), loads its progress data (`loadProfileData`), and resets the celebration queue for this
 * sitting. Leaves `screen`/`profiles` to the caller — they differ per entry point.
 */
async function activateProfile(
  set: AppSet,
  get: AppGet,
  profile: Profile,
  settings: ProfileSettings,
): Promise<void> {
  const { services } = get();
  const data = await loadProfileData(get, profile.id);
  services.setVoiceEnabled(settings.voice);
  services.setNickname(profile.nickname);
  set({
    profile,
    activeProfileSettings: settings,
    ...data,
    activeCelebration: null,
    celebrationsShownThisSession: 0,
  });
}

export function createProfileSlice(set: AppSet, get: AppGet): ProfileSlice {
  return {
    profiles: [],
    profile: null,
    activeProfileSettings: DEFAULT_PROFILE_SETTINGS,
    progress: [],
    miniGameProgress: [],
    gameRecords: [],
    conceptStats: [],
    journey: null,

    async finishFirstRun() {
      const { services } = get();
      const profiles = await listProfiles(services.deps);
      if (profiles.length === 0) {
        set({ profiles });
        void get().navigate({ name: 'new-player' });
        return;
      }
      const [only] = profiles;
      if (profiles.length === 1 && only) {
        // M1-upgrade path: an existing single profile with no parent lock yet skips profile
        // creation and goes straight to Home.
        await selectProfile(services.deps, only.id);
        const settings = await getProfileSettings(services.deps, only.id);
        await activateProfile(set, get, only, settings);
        set({ profiles });
        get().reset({ name: 'home' });
        return;
      }
      await get().goToPicker();
    },

    async finishNewPlayer(nickname: string, avatar: string) {
      const { services } = get();
      const profile = await createProfile(services.deps, nickname, avatar);
      // Storage eviction (non-functional.md §1): asks once, on whichever
      // profile creation happens first on this device — a no-op every time after (see
      // `requestPersistentStorageIfNeeded`'s own doc comment).
      await requestPersistentStorageIfNeeded(services.deps);
      // Where the wizard returns to (picker vs parent area's "Add child") is read straight off the
      // stack — `startNewPlayer` pushed 'new-player' on top of whichever it was.
      const { stack } = get();
      const returnsToParent = stack[stack.length - 2]?.name === 'parent';
      if (returnsToParent) {
        const profiles = await listProfiles(services.deps);
        set({ profiles });
        void get().back();
        return;
      }
      await selectProfile(services.deps, profile.id);
      // A brand-new profile has no stored settings yet: DEFAULT_PROFILE_SETTINGS applies as-is
      // (voice on), no need to round-trip `getProfileSettings` for a row that cannot exist yet.
      await activateProfile(set, get, profile, DEFAULT_PROFILE_SETTINGS);
      const profiles = await listProfiles(services.deps);
      set({ profiles });
      // app-structure.md §3 / domain-model.md §3.2: offered once, right after creating a new
      // player (not when a parent added a child from the parent area — that path stays on
      // `finishNewPlayer`'s own early return above, straight back to 'parent').
      get().reset({ name: 'home' }, { name: 'placement-offer' });
    },

    async selectProfileAndHome(profileId: string) {
      const { services } = get();
      const profile = await services.deps.profiles.get(profileId);
      if (!profile) return;
      await selectProfile(services.deps, profileId);
      const settings = await getProfileSettings(services.deps, profileId);
      await activateProfile(set, get, profile, settings);
      get().reset({ name: 'home' });
    },

    async refreshProfiles() {
      const { services } = get();
      const profiles = await listProfiles(services.deps);
      set({ profiles });
    },

    async refreshProgress() {
      const { profile } = get();
      if (!profile) return;
      set(await loadProfileData(get, profile.id));
    },
  };
}
