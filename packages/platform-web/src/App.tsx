import { lazy, Suspense, useEffect, useState } from 'react';
import type { ComponentType, JSX } from 'react';
import type { AppConfig } from '@learn/platform-core';
import { createAppStore, StoreProvider, useAppStore } from './app/store.ts';
import type { RouteName } from './app/routes.ts';
import { createServices } from './app/services.ts';
import type { Services } from './app/services.ts';
import { PackProvider } from './app/subject.ts';
import type { SubjectWeb } from './app/subject.ts';
import type { AppUpdate } from './adapters/app-update.ts';
import { AppNotice } from './ui/AppNotice.tsx';
import { AppUpdater } from './ui/AppUpdater.tsx';
import { Celebration } from './ui/Celebration.tsx';
import { DenScreen } from './ui/DenScreen.tsx';
import { FirstRunScreen } from './ui/FirstRunScreen.tsx';
import { HomeScreen } from './ui/HomeScreen.tsx';
import { JourneyScreen } from './ui/JourneyScreen.tsx';
import { LazyFallback } from './ui/LazyFallback.tsx';
import { LessonScreen } from './ui/LessonScreen.tsx';
import { MiniGameSessionScreen } from './ui/MiniGameSessionScreen.tsx';
import { NewPlayerScreen } from './ui/NewPlayerScreen.tsx';
import { PasswordScreen } from './ui/PasswordScreen.tsx';
import { PracticeRunScreen } from './ui/PracticeRunScreen.tsx';
import { PracticeScreen } from './ui/PracticeScreen.tsx';
import { ProfilePickerScreen } from './ui/ProfilePickerScreen.tsx';
import { SessionSummaryScreen } from './ui/SessionSummaryScreen.tsx';
import { TimeLimitScreen } from './ui/TimeLimitScreen.tsx';
import { TimeTracker } from './ui/TimeTracker.tsx';
import { WarmUpScreen } from './ui/WarmUpScreen.tsx';

// Lazy screens (non-functional.md §4): own chunks, precached by the service worker after first fetch; chosen for size (Parent
// area) or being off the every-session path. A subject's lazy screens are its `pack.routes`' concern.
const ParentAreaScreen = lazy(() =>
  import('./ui/ParentAreaScreen.tsx').then((module) => ({ default: module.ParentAreaScreen })),
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

/** Platform route → component table; a subject's routes (chess: Play, Full game, Friend play) come from `pack.routes`. */
const PLATFORM_ROUTE_SCREENS: Readonly<Partial<Record<RouteName, ComponentType>>> = {
  loading: LoadingScreen,
  'first-run': FirstRunScreen,
  'new-player': NewPlayerScreen,
  picker: ProfilePickerScreen,
  password: PasswordScreen,
  parent: ParentAreaScreen,
  lesson: LessonScreen,
  home: HomeScreen,
  journey: JourneyScreen,
  den: DenScreen,
  minigame: MiniGameSessionScreen,
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
  const pack = useAppStore((state) => state.pack);
  const screen = useAppStore((state) => state.screen);
  const ScreenComponent = PLATFORM_ROUTE_SCREENS[screen] ?? pack.routes[screen]?.screen;
  if (!ScreenComponent) throw new Error(`No screen registered for route "${screen}"`);
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
  readonly appUpdate?: AppUpdate;
  readonly pack: SubjectWeb;
  /** The app's identity (storage prefix, file prefixes); `version` is stamped at build time. */
  readonly app: Omit<AppConfig, 'version'>;
}

export default function App({
  services,
  appUpdate = NOOP_APP_UPDATE,
  pack,
  app,
}: AppProps): JSX.Element {
  const [store] = useState(() => createAppStore(services ?? createServices(pack, app), pack));
  const [initError, setInitError] = useState<Error | null>(null);

  useEffect(() => {
    store
      .getState()
      .init()
      .catch((error: unknown) => {
        setInitError(error instanceof Error ? error : new Error(String(error)));
      });
  }, [store]);

  // A failed start (e.g. storage unreadable) reaches `AppErrorBoundary` (`mountApp`) instead of
  // leaving the blank 'loading' screen up forever.
  if (initError !== null) throw initError;

  return (
    <PackProvider value={pack}>
      <StoreProvider value={store}>
        <Suspense fallback={<LazyFallback />}>
          <Screens />
        </Suspense>
        <Celebration />
        <AppNotice />
        <TimeTracker />
        <AppUpdater appUpdate={appUpdate} />
      </StoreProvider>
    </PackProvider>
  );
}
