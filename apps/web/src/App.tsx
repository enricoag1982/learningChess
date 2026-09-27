import { lazy, Suspense, useEffect, useState } from 'react';
import type { ComponentType, JSX } from 'react';
import { createAppStore, StoreProvider, useAppStore } from './app/store.ts';
import type { RouteName } from './app/routes.ts';
import { createServices } from './app/services.ts';
import type { Services } from './app/services.ts';
import type { AppUpdate } from './adapters/app-update.ts';
import { AppNotice } from './ui/AppNotice.tsx';
import { AppUpdater } from './ui/AppUpdater.tsx';
import { Celebration } from './ui/Celebration.tsx';
import { DenScreen } from './ui/DenScreen.tsx';
import { FirstRunScreen } from './ui/FirstRunScreen.tsx';
import { FullGameScreen } from './ui/FullGameScreen.tsx';
import { HomeScreen } from './ui/HomeScreen.tsx';
import { JourneyScreen } from './ui/JourneyScreen.tsx';
import { LazyFallback } from './ui/LazyFallback.tsx';
import { LessonScreen } from './ui/LessonScreen.tsx';
import { MiniGameSessionScreen } from './ui/MiniGameSessionScreen.tsx';
import { NewPlayerScreen } from './ui/NewPlayerScreen.tsx';
import { PasswordScreen } from './ui/PasswordScreen.tsx';
import { PlayScreen } from './ui/PlayScreen.tsx';
import { PracticeRunScreen } from './ui/PracticeRunScreen.tsx';
import { PracticeScreen } from './ui/PracticeScreen.tsx';
import { ProfilePickerScreen } from './ui/ProfilePickerScreen.tsx';
import { SessionSummaryScreen } from './ui/SessionSummaryScreen.tsx';
import { TimeLimitScreen } from './ui/TimeLimitScreen.tsx';
import { TimeTracker } from './ui/TimeTracker.tsx';
import { WarmUpScreen } from './ui/WarmUpScreen.tsx';

// Lazy-loaded screens (non-functional.md §4): each split into its own chunk, precached by the
// service worker right after first fetch. Picked for size (Parent area) or for being off the
// every-session path (Friend play, placement/test-out); every other screen stays static.
const ParentAreaScreen = lazy(() =>
  import('./ui/ParentAreaScreen.tsx').then((module) => ({ default: module.ParentAreaScreen })),
);
const FriendSetupScreen = lazy(() =>
  import('./ui/FriendSetupScreen.tsx').then((module) => ({ default: module.FriendSetupScreen })),
);
const FriendGameScreen = lazy(() =>
  import('./ui/FriendGameScreen.tsx').then((module) => ({ default: module.FriendGameScreen })),
);
const PlacementOfferScreen = lazy(() =>
  import('./ui/PlacementOfferScreen.tsx').then((module) => ({
    default: module.PlacementOfferScreen,
  })),
);
const PlacementScreen = lazy(() =>
  import('./ui/PlacementScreen.tsx').then((module) => ({ default: module.PlacementScreen })),
);
const AssessmentScreen = lazy(() =>
  import('./ui/AssessmentScreen.tsx').then((module) => ({ default: module.AssessmentScreen })),
);

/** The instant before `init()` resolves: a blank cream screen beats a flash of the wrong one. */
function LoadingScreen(): JSX.Element {
  return <main className="min-h-dvh bg-cream" />;
}

/** Route → component table. */
const ROUTE_SCREENS: Readonly<Record<RouteName, ComponentType>> = {
  loading: LoadingScreen,
  'first-run': FirstRunScreen,
  'new-player': NewPlayerScreen,
  picker: ProfilePickerScreen,
  password: PasswordScreen,
  parent: ParentAreaScreen,
  lesson: LessonScreen,
  home: HomeScreen,
  journey: JourneyScreen,
  play: PlayScreen,
  den: DenScreen,
  minigame: MiniGameSessionScreen,
  'full-game': FullGameScreen,
  'friend-setup': FriendSetupScreen,
  'friend-game': FriendGameScreen,
  warmup: WarmUpScreen,
  practice: PracticeScreen,
  'practice-run': PracticeRunScreen,
  'today-summary': SessionSummaryScreen,
  'placement-offer': PlacementOfferScreen,
  placement: PlacementScreen,
  assessment: AssessmentScreen,
  'time-limit': TimeLimitScreen,
};

function Screens(): JSX.Element {
  const screen = useAppStore((state) => state.screen);
  const ScreenComponent = ROUTE_SCREENS[screen];
  return <ScreenComponent />;
}

/** Never applies an update on its own: the default for tests and any render without `appUpdate`. */
const NOOP_APP_UPDATE: AppUpdate = {
  isUpdateReady: () => false,
  apply: () => Promise.resolve(),
  onUpdateReady: () => () => undefined,
};

export interface AppProps {
  /** Injected in tests (fake narrator + in-memory storage); defaults to the real web adapters. */
  readonly services?: Services;
  /** Injected from `main.tsx` or a fake in tests; defaults to a no-op. */
  readonly appUpdate?: AppUpdate;
}

/** App root: wires one `Services` instance to a fresh store, then renders the current screen. */
export default function App({ services, appUpdate = NOOP_APP_UPDATE }: AppProps): JSX.Element {
  const [store] = useState(() => createAppStore(services ?? createServices()));
  const [initError, setInitError] = useState<Error | null>(null);

  useEffect(() => {
    store
      .getState()
      .init()
      .catch((error: unknown) => {
        setInitError(error instanceof Error ? error : new Error(String(error)));
      });
  }, [store]);

  // A failed start (e.g. storage unreadable) reaches `AppErrorBoundary` (`main.tsx`) instead of
  // leaving the blank 'loading' screen up forever.
  if (initError !== null) throw initError;

  return (
    <StoreProvider value={store}>
      <Suspense fallback={<LazyFallback />}>
        <Screens />
      </Suspense>
      <Celebration />
      <AppNotice />
      <TimeTracker />
      <AppUpdater appUpdate={appUpdate} />
    </StoreProvider>
  );
}
