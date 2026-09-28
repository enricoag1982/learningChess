import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import '@fontsource-variable/fredoka';
import '@fontsource-variable/nunito';
import './index.css';
import './app-i18n.ts';
import App from './App.tsx';
import { AppErrorBoundary } from './ui/AppErrorBoundary.tsx';
import { createAppUpdate } from '@learn/platform-web/adapters/app-update.ts';
import { chessWeb } from './chess-pack.ts';
import type { SubjectWeb } from './app/subject.ts';

/** Widened from `chessWeb`'s own literal-keyed `dev` so a dynamic `location.hash` can index it;
 * `chessWeb.dev` itself is `undefined` outside a dev build (`chess-pack.ts`). */
const devScreens: NonNullable<SubjectWeb['dev']> = chessWeb.dev ?? {};

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element "#root" not found');
}

const root = createRoot(rootElement);

// Registered here, the composition root, so `App.test.tsx` never touches `virtual:pwa-register`
// (unavailable outside a Vite/PWA build).
const appUpdate = createAppUpdate(registerSW);

// Dev-only board/exercise/lesson playgrounds at /#board, /#exercises (the active subject's own,
// `pack.dev`), /#lesson=<id>; dynamically imported so none reaches the production bundle.
const devScreen = import.meta.env.DEV ? devScreens[location.hash] : undefined;
if (devScreen) {
  void devScreen().then((Screen) => {
    root.render(
      <StrictMode>
        <Screen />
      </StrictMode>,
    );
  });
} else if (import.meta.env.DEV && location.hash.startsWith('#lesson=')) {
  void import('./dev/LessonPreview.tsx').then(({ LessonPreview }) => {
    root.render(
      <StrictMode>
        <LessonPreview />
      </StrictMode>,
    );
  });
} else {
  root.render(
    <StrictMode>
      <AppErrorBoundary>
        <App appUpdate={appUpdate} />
      </AppErrorBoundary>
    </StrictMode>,
  );
}
