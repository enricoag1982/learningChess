import { createContext, useContext } from 'react';
import type { AppUpdate } from '../adapters/app-update.ts';

const AppUpdateContext = createContext<AppUpdate | null>(null);

export const AppUpdateProvider = AppUpdateContext.Provider;

/** The app's update handle (`App`'s `appUpdate`), for screens that act on it (the parent area's "Reload latest version"). */
export function useAppUpdate(): AppUpdate {
  const appUpdate = useContext(AppUpdateContext);
  if (!appUpdate) {
    throw new Error('useAppUpdate must be used within an AppUpdateProvider');
  }
  return appUpdate;
}
