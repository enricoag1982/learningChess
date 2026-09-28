import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { createProfile } from '@learn/platform-core';
import type { AppStore } from '../app/store.ts';
import { createAppStore, StoreProvider } from '../app/store.ts';
import type { Services } from '../app/services.ts';
import { PackProvider } from '../app/subject.ts';
import type { SubjectWeb } from '../app/subject.ts';

/**
 * Renders `ui` under a freshly-created store bound to `services` and `pack`, with a profile
 * already selected (screen: `home`). For component tests below the profile/first-run flow
 * (`LessonScreen`, `ExerciseStep`, `BossStep`, …): they only need `profile`/`progress` populated,
 * not real first-run/picker navigation, so this skips `init()` (which would otherwise route to the
 * first-run screen, since no parent lock exists here) and selects a profile directly.
 */
export async function renderWithStore(
  ui: ReactElement,
  services: Services,
  pack: SubjectWeb,
): Promise<{ readonly store: AppStore }> {
  const store = createAppStore(services, pack);
  const profile = await createProfile(services.deps, 'Test Kid', 'fox');
  await store.getState().selectProfileAndHome(profile.id);
  render(
    <StoreProvider value={store}>
      <PackProvider value={pack}>{ui}</PackProvider>
    </StoreProvider>,
  );
  return { store };
}
