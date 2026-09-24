import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { createAppStore, StoreProvider, useAppStore } from './app/store.ts';
import { createServices } from './app/services.ts';
import type { Services } from './app/services.ts';
import { HomeScreen } from './ui/HomeScreen.tsx';
import { LessonScreen } from './ui/LessonScreen.tsx';

function Screens(): JSX.Element {
  const screen = useAppStore((state) => state.screen);
  return screen === 'lesson' ? <LessonScreen /> : <HomeScreen />;
}

export interface AppProps {
  /** Injected in tests (fake narrator + in-memory storage); defaults to the real web adapters. */
  readonly services?: Services;
}

/** App root: wires one `Services` instance to a fresh store, then renders Home or the lesson. */
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
