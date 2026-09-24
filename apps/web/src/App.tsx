import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { createAppStore, StoreProvider, useAppStore } from './app/store.ts';
import { createServices } from './app/services.ts';
import type { Services } from './app/services.ts';
import { DenScreen } from './ui/DenScreen.tsx';
import { FirstRunScreen } from './ui/FirstRunScreen.tsx';
import { FriendGameScreen } from './ui/FriendGameScreen.tsx';
import { FriendSetupScreen } from './ui/FriendSetupScreen.tsx';
import { FullGameScreen } from './ui/FullGameScreen.tsx';
import { HomeScreen } from './ui/HomeScreen.tsx';
import { JourneyScreen } from './ui/JourneyScreen.tsx';
import { LessonScreen } from './ui/LessonScreen.tsx';
import { MiniGameSessionScreen } from './ui/MiniGameSessionScreen.tsx';
import { NewPlayerScreen } from './ui/NewPlayerScreen.tsx';
import { ParentAreaScreen } from './ui/ParentAreaScreen.tsx';
import { PasswordScreen } from './ui/PasswordScreen.tsx';
import { PlayScreen } from './ui/PlayScreen.tsx';
import { PracticeRunScreen } from './ui/PracticeRunScreen.tsx';
import { PracticeScreen } from './ui/PracticeScreen.tsx';
import { ProfilePickerScreen } from './ui/ProfilePickerScreen.tsx';
import { SessionSummaryScreen } from './ui/SessionSummaryScreen.tsx';
import { WarmUpScreen } from './ui/WarmUpScreen.tsx';

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
      <Screens />
    </StoreProvider>
  );
}
