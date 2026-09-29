import {
  composeDefaultSettings,
  createProfile,
  getProfileSettings,
  listProfiles,
  loadGameRecords,
  loadJourney,
  loadMiniGameProgress,
  loadProgress,
  selectProfile,
  type ConceptStats,
  type GameRecord,
  type Journey,
  type LessonProgress,
  type MiniGameProgress,
  type Profile,
  type ProfileSettings,
} from '@learn/platform-core';
import { requestPersistentStorageIfNeeded } from '../../adapters/persistent-storage.ts';
import type { AppGet, AppSet } from '../store.ts';
import type { SubjectWeb } from '../subject.ts';
import { loadRewards, type RewardsSlice } from './rewards.ts';

export interface ProfileSlice {
  readonly profiles: readonly Profile[];
  readonly profile: Profile | null;
  /** `profile`'s own parent-set settings (app-structure.md §11); the composed defaults outside a
   * selected profile. Voice is applied at load time, not read from here. */
  readonly activeProfileSettings: ProfileSettings;
  readonly progress: readonly LessonProgress[];
  readonly miniGameProgress: readonly MiniGameProgress[];
  readonly gameRecords: readonly GameRecord[];
  /** Concept mastery + review state; Home's "Start today" and Practice's due count / weak tags read it. */
  readonly conceptStats: readonly ConceptStats[];
  readonly journey: Journey | null;

  /** First run: after "Saved", to the new-player wizard, Home (one existing profile) or the picker (more than one). */
  readonly finishFirstRun: () => Promise<void>;
  readonly finishNewPlayer: (nickname: string, avatar: string) => Promise<void>;
  readonly selectProfileAndHome: (profileId: string) => Promise<void>;
  readonly refreshProfiles: () => Promise<void>;
  /** Re-reads lesson + mini-game progress and the derived Journey, e.g. after a lesson or mini-game session. */
  readonly refreshProgress: () => Promise<void>;
}

/** Loaded together by `activateProfile` / `refreshProgress`; the same fields `ProfileSlice` and `RewardsSlice` declare. */
type ProfileData = Pick<
  ProfileSlice,
  'progress' | 'miniGameProgress' | 'gameRecords' | 'conceptStats' | 'journey'
> &
  Pick<RewardsSlice, 'earnedBadges' | 'streak'>;

/** Progress, journey and rewards loaded in parallel; shared by `activateProfile` and `refreshProgress`. */
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

/** Re-reads and stores the profiles list; shared by `refreshProfiles` and other call sites. */
export async function reloadProfiles(set: AppSet, get: AppGet): Promise<readonly Profile[]> {
  const profiles = await listProfiles(get().services.deps);
  set({ profiles });
  return profiles;
}

async function selectAndGoHome(set: AppSet, get: AppGet, profile: Profile): Promise<void> {
  const { services } = get();
  await selectProfile(services.deps, profile.id);
  const settings = await getProfileSettings(services.deps, profile.id);
  await activateProfile(set, get, profile, settings);
  get().reset({ name: 'home' });
}

export function createProfileSlice(set: AppSet, get: AppGet, pack: SubjectWeb): ProfileSlice {
  const defaultSettings = composeDefaultSettings(pack.core.settings);
  return {
    profiles: [],
    profile: null,
    activeProfileSettings: defaultSettings,
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
      await activateProfile(set, get, profile, defaultSettings);
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
}
