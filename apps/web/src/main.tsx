import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/fredoka';
import '@fontsource-variable/nunito';
import './index.css';
import './i18n.ts';
import App from './App.tsx';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element "#root" not found');
}

const root = createRoot(rootElement);

// Dev-only board / exercise playgrounds at /#board and /#exercises; dynamically imported so
// neither reaches the production bundle (see src/dev/BoardPlayground.tsx, ExercisePlayground.tsx).
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
} else {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
