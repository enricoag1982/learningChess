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

/** Props for a subject's own settings chips (`SubjectWeb.loadParent`'s `SettingsPanel`), rendered
 * inside `ChildSettings`'s generic settings section. */
export interface ParentSettingsProps {
  readonly profileId: string;
  readonly settings: ProfileSettings;
  readonly patchSettings: (patch: Partial<ProfileSettings>) => Promise<void>;
}

/** Props for a subject's own report section (`SubjectWeb.loadParent`'s `ReportSection`), rendered
 * inside `ChildReport` alongside the platform's own sections. */
export interface ReportSectionProps {
  readonly games: readonly GameRecord[];
  readonly profilesById: ReadonlyMap<string, Profile>;
}

/** A subject's own runtime services, augmented by module declaration (chess: `{ botPlayer }`). */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- augmented per subject
export interface SubjectServices {}

/** A board/story/demo surface's own lesson world, for the subject's piece look (chess: the animal
 * badge, off in World 5 and for a review task, `worldId: null`). */
export interface SurfaceContext {
  readonly worldId: string | null;
}

/** One subject's whole web behaviour behind the platform's uniform interface (docs/refactor-v4.md
 * §11). Grows a field per seam commit; a subject omits what it has no use for. */
export interface SubjectWeb {
  readonly core: SubjectCore;
  /** Built once at composition-root time (`app/services.ts`), never per render: the subject's own
   * content (read by the use cases) and services (chess: a worker-backed bot player, for the UI). */
  createServices(): { readonly content: ContentSource; readonly subject: SubjectServices };
  /** Every exercise kind's UI, by `type` — `ExercisePlay`'s one dispatch point. */
  readonly kinds: Readonly<Record<string, AnyExerciseKindUI>>;
  /** This subject's mini-game mode UIs, by `mode` (chess: static, versus); `BossStep` adds `series`. */
  readonly modes: Readonly<Record<string, MiniGameModeUI>>;
  /** The lesson's board (Story, Demo) and a finished round's board (View): method syntax (bivariant),
   * so a subject's own `Lesson` / state (fields beyond the base) widens here with no cast. */
  readonly surface: {
    Story(props: { readonly lesson: Lesson; readonly compact: boolean }): JSX.Element;
    Demo(props: { readonly lesson: Lesson }): JSX.Element;
    View(props: { state: ExerciseStateBase; surface: SurfaceContext }): JSX.Element;
  };
  /** The piece-icon pill under a character's portrait, naming the piece it stands for
   * (`CharacterCard`); absent for a subject with no such badge. */
  CharacterBadge?(props: { readonly character: string }): JSX.Element | null;
  /** This subject's own art (chess: lesson characters, bot levels), keyed by id; falls back to the
   * platform's own (avatars, Owl) for an id it doesn't have. */
  readonly art: Readonly<Record<string, string>>;
  /** Extra Home tiles this subject contributes (chess: Play), merged with the platform's own
   * (Journey/Practice/My Den) and sorted by `order`; absent for a subject with none. */
  readonly homeTiles?: readonly HomeTile[];
  /** My Den's own bits: the rank ladder's glyph per rank id, and an extra stats row (chess: games
   * won / with friends) under the rank/friends panels; `Stats` absent for a subject with none. */
  readonly den: {
    rankGlyph(rankId: string): string;
    Stats?(props: { readonly gameRecords: readonly GameRecord[] }): JSX.Element;
  };
  /** Lazy-loaded parent-area panels (chess: level + piece-style chips, the games-played section) —
   * a dynamic import so they stay inside the app's own lazy parent chunk, never the initial bundle.
   * Absent for a subject with no parent-area contribution. */
  loadParent?(): Promise<ParentPanels>;
  /** Every route this subject contributes (chess: `play`, `full-game`, `friend-setup`,
   * `friend-game`), keyed by name; the platform's own routes never appear here. */
  readonly routes: Readonly<Record<string, SubjectRouteEntry>>;
  /** This subject's own store slice (chess: `PlaySlice`), spread into `AppState` alongside the
   * platform's own; absent for a subject with no state of its own. */
  readonly createSlice?: SliceCreator<SubjectState>;
  /** Fields reset on every "back to Home" (chess: clears `levelUpSuggestion`); absent for a
   * subject with nothing to reset. */
  readonly homeReset?: Partial<SubjectState>;
  /** Dev-only playground screens, by URL hash (`main.tsx`, `#board`/`#exercises`); dynamically
   * imported so they never reach the production bundle. Absent for a subject with none. */
  readonly dev?: Readonly<Record<string, () => Promise<ComponentType>>>;
}

/** One subject-contributed route's screen, per-route flags, and optional entry side effect (chess
 * `full-game`: clears a stale level-up banner). */
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
