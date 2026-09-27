import { render, screen, type RenderResult } from '@testing-library/react';
import App from '../App.tsx';
import type { Services } from '../app/services.ts';
import { pickProfileFromPicker } from './app-test-helpers.ts';

/**
 * Renders `<App services={services} />` and gets past the picker: `at: 'home'` taps the tile named
 * `nickname` (default `'Mia'`) — the caller seeds that returning profile first, same as before —
 * landing on Home; `at: 'picker'` renders and waits for the picker itself, without picking anyone
 * (first-run/onboarding tests, with no profile yet, render `<App>` directly instead).
 */
export async function renderApp(
  services: Services,
  options: { readonly at: 'home'; readonly nickname?: string } | { readonly at: 'picker' },
): Promise<RenderResult> {
  const result = render(<App services={services} />);
  if (options.at === 'home') {
    await pickProfileFromPicker(options.nickname ?? 'Mia');
  } else {
    await screen.findByRole('heading', { name: "Who's playing today?" });
  }
  return result;
}
