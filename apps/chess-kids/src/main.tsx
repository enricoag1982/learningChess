import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import '@fontsource-variable/fredoka';
import '@fontsource-variable/nunito';
import './index.css';
import './app-i18n.ts';
import { CHESS_APP_CONFIG } from '@learn/subject-chess';
import { chessWeb } from '@learn/subject-chess/web/chess-pack.ts';
import App from '@learn/platform-web/App.tsx';
import { AppErrorBoundary } from '@learn/platform-web/ui/AppErrorBoundary.tsx';
import { createAppUpdate } from '@learn/platform-web/adapters/app-update.ts';
import type { SubjectWeb } from '@learn/platform-web/app/subject.ts';

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
  void import('@learn/subject-chess/web/dev/LessonPreview.tsx').then(({ LessonPreview }) => {
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
        <App appUpdate={appUpdate} pack={chessWeb} app={CHESS_APP_CONFIG} />
      </AppErrorBoundary>
    </StrictMode>,
  );
}
