import type {
  ConceptStats,
  GameRecord,
  Journey,
  LessonProgress,
  MiniGameProgress,
  Profile,
  ProfileSettings,
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
  /** `profile`'s own parent-set settings (M5.1, app-structure.md §11), loaded alongside it —
   * `ExerciseStep`'s Hint button and `PlayScreen`'s computer-level default both read this;
   * `DEFAULT_PROFILE_SETTINGS` outside a selected profile. Voice is applied as a side effect at
   * load time (`services.setVoiceEnabled`), not read from here (`gated-narrator.ts` owns it). */
  readonly activeProfileSettings: ProfileSettings;
  readonly progress: readonly LessonProgress[];
  /** This profile's standalone mini-game progress (Play screen's best-stars tiles). */
  readonly miniGameProgress: readonly MiniGameProgress[];
  /** This profile's full-game / versus mini-game records (Play's vs Computer tally, My Den). */
  readonly gameRecords: readonly GameRecord[];
  /** This profile's concept mastery + review state (M3.4 Leitner scheduler): Home's "Start today"
   * button and the Practice screen's due count / weak tags both read this. */
  readonly conceptStats: readonly ConceptStats[];
  /** This profile's Journey (tracks/worlds/lesson statuses/next lesson/rank); `null` until loaded. */
  readonly journey: Journey | null;
  /** New-player wizard: return to Parent area instead of Home once it creates the profile. */
  readonly newPlayerReturnsToParent: boolean;

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
    newPlayerReturnsToParent: false,

    async finishFirstRun() {
      const { services } = get();
      const profiles = await listProfiles(services.deps);
      if (profiles.length === 0) {
        set({ screen: 'new-player', newPlayerReturnsToParent: false, profiles });
        return;
      }
      const [only] = profiles;
      if (profiles.length === 1 && only) {
        // M1-upgrade path: an existing single profile with no parent lock yet skips profile
        // creation and goes straight to Home (see the M2.1 spec's "Existing installs" note).
        await selectProfile(services.deps, only.id);
        const [progress, miniGameProgress, gameRecords, conceptStats, journey, rewards, settings] =
          await Promise.all([
            loadProgress(services.deps, only.id),
            loadMiniGameProgress(services.deps, only.id),
            loadGameRecords(services.deps, only.id),
            services.deps.progress.listConceptStats(only.id),
            loadJourney(services.deps, only.id),
            loadRewards(get, only.id),
            getProfileSettings(services.deps, only.id),
          ]);
        services.setVoiceEnabled(settings.voice);
        services.setNickname(only.nickname);
        set({
          profile: only,
          activeProfileSettings: settings,
          progress,
          miniGameProgress,
          gameRecords,
          conceptStats,
          journey,
          profiles,
          earnedBadges: rewards.earnedBadges,
          streak: rewards.streak ?? null,
          activeCelebration: null,
          celebrationsShownThisSession: 0,
          screen: 'home',
        });
        return;
      }
      await get().goToPicker();
    },

    async finishNewPlayer(nickname: string, avatar: string) {
      const { services } = get();
      const profile = await createProfile(services.deps, nickname, avatar);
      // Storage eviction (non-functional.md §1, M5.4 decision table): asks once, on whichever
      // profile creation happens first on this device — a no-op every time after (see
      // `requestPersistentStorageIfNeeded`'s own doc comment).
      await requestPersistentStorageIfNeeded(services.deps);
      if (get().newPlayerReturnsToParent) {
        const profiles = await listProfiles(services.deps);
        set({ profiles, screen: 'parent' });
        return;
      }
      await selectProfile(services.deps, profile.id);
      const [profiles, progress, miniGameProgress, gameRecords, conceptStats, journey, rewards] =
        await Promise.all([
          listProfiles(services.deps),
          loadProgress(services.deps, profile.id),
          loadMiniGameProgress(services.deps, profile.id),
          loadGameRecords(services.deps, profile.id),
          services.deps.progress.listConceptStats(profile.id),
          loadJourney(services.deps, profile.id),
          loadRewards(get, profile.id),
        ]);
      // A brand-new profile has no stored settings yet: DEFAULT_PROFILE_SETTINGS applies as-is
      // (voice on), no need to round-trip `getProfileSettings` for a row that cannot exist yet.
      services.setVoiceEnabled(DEFAULT_PROFILE_SETTINGS.voice);
      services.setNickname(profile.nickname);
      set({
        profile,
        activeProfileSettings: DEFAULT_PROFILE_SETTINGS,
        progress,
        miniGameProgress,
        gameRecords,
        conceptStats,
        journey,
        profiles,
        earnedBadges: rewards.earnedBadges,
        streak: rewards.streak ?? null,
        activeCelebration: null,
        celebrationsShownThisSession: 0,
        // app-structure.md §3 / domain-model.md §3.2: offered once, right after creating a new
        // player (not when a parent added a child from the parent area — that path stays on
        // `finishNewPlayer`'s own early return above, straight back to 'parent').
        screen: 'placement-offer',
      });
    },

    async selectProfileAndHome(profileId: string) {
      const { services } = get();
      const profile = await services.deps.profiles.get(profileId);
      if (!profile) return;
      await selectProfile(services.deps, profileId);
      const [progress, miniGameProgress, gameRecords, conceptStats, journey, rewards, settings] =
        await Promise.all([
          loadProgress(services.deps, profileId),
          loadMiniGameProgress(services.deps, profileId),
          loadGameRecords(services.deps, profileId),
          services.deps.progress.listConceptStats(profileId),
          loadJourney(services.deps, profileId),
          loadRewards(get, profileId),
          getProfileSettings(services.deps, profileId),
        ]);
      // Settings effect now (app-structure.md §11): voice/hints/computer level take effect the
      // next time this profile is selected — voice is applied here as a side effect (gates the
      // shared narrator), the rest is read straight off `activeProfileSettings` by the screens
      // that need it (`ExerciseStep`'s Hint button, `PlayScreen`'s computer-level default).
      services.setVoiceEnabled(settings.voice);
      services.setNickname(profile.nickname);
      set({
        profile,
        activeProfileSettings: settings,
        progress,
        miniGameProgress,
        gameRecords,
        conceptStats,
        journey,
        earnedBadges: rewards.earnedBadges,
        streak: rewards.streak ?? null,
        activeCelebration: null,
        celebrationsShownThisSession: 0,
        screen: 'home',
      });
    },

    async refreshProfiles() {
      const { services } = get();
      const profiles = await listProfiles(services.deps);
      set({ profiles });
    },

    async refreshProgress() {
      const { profile, services } = get();
      if (!profile) return;
      const [progress, miniGameProgress, gameRecords, conceptStats, journey, rewards] =
        await Promise.all([
          loadProgress(services.deps, profile.id),
          loadMiniGameProgress(services.deps, profile.id),
          loadGameRecords(services.deps, profile.id),
          services.deps.progress.listConceptStats(profile.id),
          loadJourney(services.deps, profile.id),
          loadRewards(get, profile.id),
        ]);
      set({
        progress,
        miniGameProgress,
        gameRecords,
        conceptStats,
        journey,
        earnedBadges: rewards.earnedBadges,
        streak: rewards.streak ?? null,
      });
    },
  };
}
