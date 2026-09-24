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

// Dev-only board playground at /#board; dynamically imported so it never reaches the production
// bundle (see src/dev/BoardPlayground.tsx).
if (import.meta.env.DEV && location.hash === '#board') {
  void import('./dev/BoardPlayground.tsx').then(({ BoardPlayground }) => {
    root.render(
      <StrictMode>
        <BoardPlayground />
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
