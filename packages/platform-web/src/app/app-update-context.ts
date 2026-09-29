import { createContext, useContext } from 'react';
import type { AppUpdate } from '../adapters/app-update.ts';

/** Never applies an update on its own: the default for tests and any render without `appUpdate`. */
export const NOOP_APP_UPDATE: AppUpdate = {
  isUpdateReady: () => false,
  apply: () => Promise.resolve(),
  onUpdateReady: () => () => undefined,
  forceRefresh: () => Promise.resolve('offline'),
};

const AppUpdateContext = createContext(NOOP_APP_UPDATE);

export const AppUpdateProvider = AppUpdateContext.Provider;

/** The app's update handle (`App`'s `appUpdate`), for screens that act on it (the parent area's "Reload latest version"). */
export function useAppUpdate(): AppUpdate {
  return useContext(AppUpdateContext);
}
