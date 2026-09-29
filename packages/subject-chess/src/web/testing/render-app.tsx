import { render, screen, type RenderResult } from '@testing-library/react';
import { CHESS_APP_CONFIG } from '../../core/chess-core.ts';
import App from '@learn/platform-web/App.tsx';
import type { AppProps } from '@learn/platform-web/App.tsx';
import { chessWeb } from '../chess-pack.ts';
import type { Services } from '@learn/platform-web/app/services.ts';
import { pickProfileFromPicker } from './app-test-helpers.ts';

/**
 * Renders the app over `services` and gets past the picker: `at: 'home'` taps the tile named
 * `nickname` (default `'Mia'`) — the caller seeds that returning profile first, same as before —
 * landing on Home; `at: 'picker'` renders and waits for the picker itself, without picking anyone
 * (first-run/onboarding tests, with no profile yet, use `renderAppRaw` instead).
 */
export async function renderApp(
  services: Services,
  options: { readonly at: 'home'; readonly nickname?: string } | { readonly at: 'picker' },
): Promise<RenderResult> {
  const result = renderAppRaw(services);
  if (options.at === 'home') {
    await pickProfileFromPicker(options.nickname ?? 'Mia');
  } else {
    await screen.findByRole('heading', { name: "Who's playing today?" });
  }
  return result;
}

/** Renders `<App>` over `services` with the chess pack and config, as `main.tsx` composes it. */
export function renderAppRaw(
  services: Services,
  props: Omit<AppProps, 'services' | 'pack' | 'app'> = {},
): RenderResult {
  return render(<App services={services} pack={chessWeb} app={CHESS_APP_CONFIG} {...props} />);
}
