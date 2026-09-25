import { lazy, Suspense, useEffect, useState } from 'react';
import type { JSX } from 'react';
import { createAppStore, StoreProvider, useAppStore } from './app/store.ts';
import { createServices } from './app/services.ts';
import type { Services } from './app/services.ts';
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
import { WarmUpScreen } from './ui/WarmUpScreen.tsx';

// Lazy-loaded screens (non-functional.md §4 "Initial JS ≤ 300 KB gzipped", M5.4 decision table
// "Lazy loading"): each split into its own chunk, only fetched the first time its screen actually
// shows — precached by the service worker (`vite.config.ts`) right after, so a repeat visit is no
// slower than a static import would have been. Picked for size (Parent area, `ui/parent/**`) or
// for being off the every-session path (Friend play, placement / test-out) — every other screen
// stays a static import, on the path most kids take most days.
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

function Screens(): JSX.Element {
  const screen = useAppStore((state) => state.screen);
  switch (screen) {
    case 'first-run':
      return <FirstRunScreen />;
    case 'new-player':
      return <NewPlayerScreen />;
    case 'picker':
      return <ProfilePickerScreen />;
    case 'password':
      return <PasswordScreen />;
    case 'parent':
      return <ParentAreaScreen />;
    case 'lesson':
      return <LessonScreen />;
    case 'home':
      return <HomeScreen />;
    case 'journey':
      return <JourneyScreen />;
    case 'play':
      return <PlayScreen />;
    case 'den':
      return <DenScreen />;
    case 'minigame':
      return <MiniGameSessionScreen />;
    case 'full-game':
      return <FullGameScreen />;
    case 'friend-setup':
      return <FriendSetupScreen />;
    case 'friend-game':
      return <FriendGameScreen />;
    case 'warmup':
      return <WarmUpScreen />;
    case 'practice':
      return <PracticeScreen />;
    case 'practice-run':
      return <PracticeRunScreen />;
    case 'today-summary':
      return <SessionSummaryScreen />;
    case 'placement-offer':
      return <PlacementOfferScreen />;
    case 'placement':
      return <PlacementScreen />;
    case 'assessment':
      return <AssessmentScreen />;
    case 'loading':
    default:
      // The instant before `init()` resolves: a blank cream screen beats a flash of the wrong one.
      return <main className="min-h-screen bg-cream" />;
  }
}

export interface AppProps {
  /** Injected in tests (fake narrator + in-memory storage); defaults to the real web adapters. */
  readonly services?: Services;
}

/** App root: wires one `Services` instance to a fresh store, then renders the current screen. */
export default function App({ services }: AppProps): JSX.Element {
  const [store] = useState(() => createAppStore(services ?? createServices()));

  useEffect(() => {
    void store.getState().init();
  }, [store]);

  return (
    <StoreProvider value={store}>
      <Suspense fallback={<LazyFallback />}>
        <Screens />
      </Suspense>
      <Celebration />
    </StoreProvider>
  );
}
