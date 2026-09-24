import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import type { AppStore } from '../app/store.ts';
import { createAppStore, StoreProvider } from '../app/store.ts';
import type { Services } from '../app/services.ts';

/** Renders `ui` under a freshly-created, already-initialised store bound to `services`. */
export async function renderWithStore(
  ui: ReactElement,
  services: Services,
): Promise<{ readonly store: AppStore }> {
  const store = createAppStore(services);
  await store.getState().init();
  render(<StoreProvider value={store}>{ui}</StoreProvider>);
  return { store };
}
