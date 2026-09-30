import { createContext, useContext } from 'react';
import type { ComponentType, JSX } from 'react';
import type {
  ContentSource,
  ExerciseStateBase,
  GameRecord,
  Lesson,
  Profile,
  ProfileSettings,
  SubjectCore,
} from '@learn/platform-core';
import type { AnyExerciseKindUI } from '../kinds/kind-ui.ts';
import type { MiniGameModeUI } from '../modes/mode-ui.ts';
import type { AppSet, SliceCreator } from './store.ts';
import { DEFAULT_ROUTE_META, PLATFORM_ROUTE_META } from './routes.ts';
import type { Route, RouteMeta, RouteName } from './routes.ts';

/** A subject's own store state, augmented by module declaration (chess: `PlaySlice`'s
 * `levelUpSuggestion`/`friendSetup` and their actions). */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- augmented per subject
export interface SubjectState {}

/** Props for a subject's settings chips (`SubjectWeb.loadParent`'s `SettingsPanel`), rendered in `ChildSettings`. */
export interface ParentSettingsProps {
  readonly profileId: string;
  readonly settings: ProfileSettings;
  readonly patchSettings: (patch: Partial<ProfileSettings>) => Promise<void>;
}

/** Props for a subject's report section (`loadParent`'s `ReportSection`), rendered in `ChildReport`. */
export interface ReportSectionProps {
  readonly games: readonly GameRecord[];
  readonly profilesById: ReadonlyMap<string, Profile>;
}

/** A subject's own runtime services, augmented by module declaration (chess: `{ botPlayer }`). */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- augmented per subject
export interface SubjectServices {}

/** One subject's whole web behaviour behind the platform interface (docs/refactor-v4.md §11); a subject omits what it doesn't use. */
export interface SubjectWeb {
  readonly core: SubjectCore;
  /** Built once at composition-root time, never per render: the subject's content (for the use cases) and services (chess: a worker-backed bot). */
  createServices(): { readonly content: ContentSource; readonly subject: SubjectServices };
  readonly kinds: Readonly<Record<string, AnyExerciseKindUI>>;
  /** This subject's mini-game mode UIs, by `mode` (chess: static, versus); `BossStep` adds `series`. */
  readonly modes: Readonly<Record<string, MiniGameModeUI>>;
  /** The lesson's board (Story, Demo) and a finished round's board (View): method syntax (bivariant),
   * so a subject's own `Lesson` / state (fields beyond the base) widens here with no cast. */
  readonly surface: {
    Story(props: { readonly lesson: Lesson; readonly compact: boolean }): JSX.Element;
    Demo(props: { readonly lesson: Lesson }): JSX.Element;
    View(props: { state: ExerciseStateBase }): JSX.Element;
  };
  /** The piece-icon pill under a character's portrait (`CharacterCard`); absent for a subject without one. */
  CharacterBadge?(props: { readonly character: string }): JSX.Element | null;
  /** This subject's own art (chess: lesson characters, bot levels), keyed by id; falls back to the
   * platform's own (avatars, Owl) for an id it doesn't have. */
  readonly art: Readonly<Record<string, string>>;
  /** Extra Home tiles (chess: Play), merged with the platform's and sorted by `order`. */
  readonly homeTiles?: readonly HomeTile[];
  /** My Den bits: a glyph per rank id, and an optional extra stats row (chess: games won / with friends). */
  readonly den: {
    rankGlyph(rankId: string): string;
    Stats?(props: { readonly gameRecords: readonly GameRecord[] }): JSX.Element;
  };
  /** Lazy parent-area panels (chess: level chips, games-played section): a dynamic import, so they stay in the
   * lazy parent chunk, not the initial bundle. */
  loadParent?(): Promise<ParentPanels>;
  /** Routes this subject contributes (chess: `play`, `full-game`, `friend-setup`, `friend-game`); the platform's never appear here. */
  readonly routes: Readonly<Record<string, SubjectRouteEntry>>;
  /** This subject's store slice (chess: `PlaySlice`), spread into `AppState`. */
  readonly createSlice?: SliceCreator<SubjectState>;
  /** Fields reset on every "back to Home" (chess: clears `levelUpSuggestion`). */
  readonly homeReset?: Partial<SubjectState>;
  /** Dev-only playground screens by URL hash (`#board`, `#exercises`; a key ending in `=` matches as a prefix, `#lesson=`), dynamically imported so they never reach the production bundle. */
  readonly dev?: Readonly<Record<string, () => Promise<ComponentType>>>;
}

/** One subject route: screen, per-route flags and an optional entry side effect (chess `full-game`: clears a stale level-up banner). */
export interface SubjectRouteEntry {
  readonly screen: ComponentType;
  readonly meta: RouteMeta;
  onEnter?(set: AppSet): void;
}

/** `name`'s own flags: the platform's, or (for a subject route) its pack entry's — never both, so
 * this is always defined for a real `RouteName`. */
export function routeMetaFor(pack: SubjectWeb, name: RouteName): RouteMeta {
  return PLATFORM_ROUTE_META[name] ?? pack.routes[name]?.meta ?? DEFAULT_ROUTE_META;
}

/** `SubjectWeb.loadParent`'s resolved shape — named so a caller's "not loaded yet" fallback stays
 * typed the same as the real thing. */
export interface ParentPanels {
  readonly SettingsPanel?: ComponentType<ParentSettingsProps>;
  readonly ReportSection?: ComponentType<ReportSectionProps>;
}

/** One Home tile's own colours (`docs/screens.md` §1: border = `fg`, ledge a still-darker shade). */
export interface HomeTileColors {
  readonly bg: string;
  readonly fg: string;
  readonly ledge: string;
}

/** A subject-contributed Home tile (`SubjectWeb.homeTiles`), rendered the same as a platform one. */
export interface HomeTile {
  readonly id: string;
  /** Placement among the platform's own tiles, lowest first. */
  readonly order: number;
  readonly labelKey: string;
  readonly Icon: () => JSX.Element;
  readonly colors: HomeTileColors;
  /** Tapping the tile navigates here — a literal `Route` value, so a subject's own routes stay
   * fully typed (chess: `{ name: 'play' }`). */
  readonly route: Route;
}

const PackContext = createContext<SubjectWeb | null>(null);

export const PackProvider = PackContext.Provider;

/** The active subject's whole web pack; must be used under `PackProvider` (`App.tsx`). */
export function usePack(): SubjectWeb {
  const pack = useContext(PackContext);
  if (!pack) {
    throw new Error('usePack must be used within a PackProvider');
  }
  return pack;
}
