import { StrictMode } from 'react';
import type { ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import type { AppConfig } from '@learn/platform-core';
import App from './App.tsx';
import { AppErrorBoundary } from './ui/AppErrorBoundary.tsx';
import { createAppUpdate } from './adapters/app-update.ts';
import type { RegisterSW } from './adapters/app-update.ts';
import type { SubjectWeb } from './app/subject.ts';

export interface MountAppOptions {
  readonly pack: SubjectWeb;
  readonly app: Omit<AppConfig, 'version'>;
  /** `virtual:pwa-register`'s `registerSW`, passed in so tests never touch the virtual module. */
  readonly registerSW: RegisterSW;
}

/** `pack.dev[hash]`; a key ending in `=` matches as a prefix (`#lesson=<id>`). */
function findDevScreen(
  dev: NonNullable<SubjectWeb['dev']>,
  hash: string,
): (() => Promise<ComponentType>) | undefined {
  return Object.entries(dev).find(
    ([key]) => key === hash || (key.endsWith('=') && hash.startsWith(key)),
  )?.[1];
}

/** The app's composition root: error boundary, update wiring and, in dev builds only, the pack's playgrounds. */
export function mountApp({ pack, app, registerSW }: MountAppOptions): void {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Root element "#root" not found');
  }
  const root = createRoot(rootElement);
  const appUpdate = createAppUpdate(registerSW);

  const devScreen =
    import.meta.env.DEV && pack.dev ? findDevScreen(pack.dev, location.hash) : undefined;
  if (devScreen) {
    void devScreen().then((Screen) => {
      root.render(
        <StrictMode>
          <Screen />
        </StrictMode>,
      );
    });
    return;
  }
  root.render(
    <StrictMode>
      <AppErrorBoundary>
        <App appUpdate={appUpdate} pack={pack} app={app} />
      </AppErrorBoundary>
    </StrictMode>,
  );
}
