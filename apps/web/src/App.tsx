import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { createAppStore, StoreProvider, useAppStore } from './app/store.ts';
import { createServices } from './app/services.ts';
import type { Services } from './app/services.ts';
import { FirstRunScreen } from './ui/FirstRunScreen.tsx';
import { HomeScreen } from './ui/HomeScreen.tsx';
import { JourneyScreen } from './ui/JourneyScreen.tsx';
import { LessonScreen } from './ui/LessonScreen.tsx';
import { NewPlayerScreen } from './ui/NewPlayerScreen.tsx';
import { ParentAreaScreen } from './ui/ParentAreaScreen.tsx';
import { PasswordScreen } from './ui/PasswordScreen.tsx';
import { ProfilePickerScreen } from './ui/ProfilePickerScreen.tsx';

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
