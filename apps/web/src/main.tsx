import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import '@fontsource-variable/fredoka';
import '@fontsource-variable/nunito';
import './index.css';
import './i18n.ts';
import App from './App.tsx';
import { AppErrorBoundary } from './ui/AppErrorBoundary.tsx';
import { createAppUpdate } from './adapters/app-update.ts';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element "#root" not found');
}

const root = createRoot(rootElement);

// Registers the service worker once, here — the app's own composition root, kept out of
// `App.tsx` so `App.test.tsx` (which imports `App.tsx` directly) never touches the
// `virtual:pwa-register` module (unavailable outside a Vite/PWA build).
const appUpdate = createAppUpdate(registerSW);

// Dev-only board / exercise / lesson playgrounds at /#board, /#exercises and /#lesson=<id>;
// dynamically imported so none reaches the production bundle (see src/dev/BoardPlayground.tsx,
// ExercisePlayground.tsx, LessonPreview.tsx).
if (import.meta.env.DEV && location.hash === '#board') {
  void import('./dev/BoardPlayground.tsx').then(({ BoardPlayground }) => {
    root.render(
      <StrictMode>
        <BoardPlayground />
      </StrictMode>,
    );
  });
} else if (import.meta.env.DEV && location.hash === '#exercises') {
  void import('./dev/ExercisePlayground.tsx').then(({ ExercisePlayground }) => {
    root.render(
      <StrictMode>
        <ExercisePlayground />
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
