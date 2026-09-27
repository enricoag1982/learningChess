import {
  type ConceptStats,
  type GameRecord,
  type Journey,
  type LessonProgress,
  type MiniGameProgress,
  type Profile,
  type ProfileSettings,
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
import type { AppGet, AppSet, SliceCreator } from '../store.ts';
import { loadRewards, type RewardsSlice } from './rewards.ts';

export interface ProfileSlice {
  /** Every profile on this device (picker tiles, parent area's children list). */
  readonly profiles: readonly Profile[];
  /** The kid currently playing (Home / Lesson); `null` outside those screens. */
  readonly profile: Profile | null;
  /** `profile`'s own parent-set settings (app-structure.md §11); `DEFAULT_PROFILE_SETTINGS`
   * outside a selected profile. Voice is applied at load time, not read from here. */
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
  /** Re-reads saved progress (lesson + mini-game) and the derived Journey from storage, e.g. after
   * a lesson or a standalone mini-game session updates it. */
  readonly refreshProgress: () => Promise<void>;
}

/** The per-profile data `activateProfile`/`refreshProgress` load and apply together — the same
 * fields `ProfileSlice` and `RewardsSlice` already declare. */
type ProfileData = Pick<
  ProfileSlice,
  'progress' | 'miniGameProgress' | 'gameRecords' | 'conceptStats' | 'journey'
> &
  Pick<RewardsSlice, 'earnedBadges' | 'streak'>;

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

/** Makes `profile` the one playing: settings side effects, progress load, celebration reset.
 * Shared by `finishFirstRun`, `finishNewPlayer`, `selectProfileAndHome`. */
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

/** Re-reads the profiles list and stores it; the shared body behind `refreshProfiles` and every
 * other call site that just needs a fresh list applied. */
export async function reloadProfiles(set: AppSet, get: AppGet): Promise<readonly Profile[]> {
  const profiles = await listProfiles(get().services.deps);
  set({ profiles });
  return profiles;
}

/** Selects `profile` and lands on Home; shared by `selectProfileAndHome` and `finishFirstRun`. */
async function selectAndGoHome(set: AppSet, get: AppGet, profile: Profile): Promise<void> {
  const { services } = get();
  await selectProfile(services.deps, profile.id);
  const settings = await getProfileSettings(services.deps, profile.id);
  await activateProfile(set, get, profile, settings);
  get().reset({ name: 'home' });
}

export const createProfileSlice: SliceCreator<ProfileSlice> = (set, get) => {
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
      const profiles = await reloadProfiles(set, get);
      if (profiles.length === 0) {
        void get().navigate({ name: 'new-player' });
        return;
      }
      const [only] = profiles;
      if (profiles.length === 1 && only) {
        // A single existing profile with no parent lock yet skips creation, straight to Home.
        await selectAndGoHome(set, get, only);
        return;
      }
      await get().goToPicker();
    },

    async finishNewPlayer(nickname: string, avatar: string) {
      const { services } = get();
      const profile = await createProfile(services.deps, nickname, avatar);
      // Storage eviction (non-functional.md §1): a no-op after the first profile on this device.
      await requestPersistentStorageIfNeeded(services.deps);
      // Return target (picker vs parent area) is read off the stack: 'new-player' sits on top.
      const { stack } = get();
      const returnsToParent = stack[stack.length - 2]?.name === 'parent';
      if (returnsToParent) {
        await reloadProfiles(set, get);
        void get().back();
        return;
      }
      await selectProfile(services.deps, profile.id);
      // A brand-new profile has no stored settings yet; defaults apply as-is (voice on).
      await activateProfile(set, get, profile, DEFAULT_PROFILE_SETTINGS);
      await reloadProfiles(set, get);
      // domain-model.md §3.2: placement offered once, right after creating a new player.
      get().reset({ name: 'home' }, { name: 'placement-offer' });
    },

    async selectProfileAndHome(profileId: string) {
      const profile = await get().services.deps.profiles.get(profileId);
      if (!profile) return;
      await selectAndGoHome(set, get, profile);
    },

    async refreshProfiles() {
      await reloadProfiles(set, get);
    },

    async refreshProgress() {
      const { profile } = get();
      if (!profile) return;
      set(await loadProfileData(get, profile.id));
    },
  };
};
