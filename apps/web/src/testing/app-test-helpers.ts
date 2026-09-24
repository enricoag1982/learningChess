import { screen, fireEvent } from '@testing-library/react';
import type { Profile } from '@chess-kids/core';
import { createProfile, selectProfile, setupParentPassword } from '@chess-kids/core';
import type { Services } from '../app/services.ts';

/**
 * Seeds a parent lock and one profile directly (bypassing the onboarding UI), as if first run
 * already happened and this profile was last selected — the state `<App>` finds at every
 * subsequent start (app-structure.md §3: picker first, that profile shown first).
 */
export async function seedReturningProfile(
  services: Services,
  nickname = 'Mia',
  avatar = 'fox',
): Promise<Profile> {
  await setupParentPassword(services.deps, '1234');
  const profile = await createProfile(services.deps, nickname, avatar);
  await selectProfile(services.deps, profile.id);
  return profile;
}

/** From an already-rendered profile picker, taps the tile named `nickname` and waits for Home. */
export async function pickProfileFromPicker(nickname: string): Promise<void> {
  fireEvent.click(await screen.findByRole('button', { name: new RegExp(nickname) }));
}
