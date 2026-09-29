import { afterEach, describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { CHESS_APP_CONFIG } from '@learn/subject-chess';
import { chessWeb } from '@learn/subject-chess/web/chess-pack.ts';
import { mountApp } from '@learn/platform-web/mount.tsx';

function mountAt(hash: string): void {
  document.body.innerHTML = '<div id="root"></div>';
  window.location.hash = hash;
  mountApp({ pack: chessWeb, app: CHESS_APP_CONFIG, registerSW: () => () => Promise.resolve() });
}

afterEach(() => {
  document.body.innerHTML = '';
  window.location.hash = '';
});

describe('mountApp', () => {
  it('renders the pack playground for an exact dev hash', async () => {
    mountAt('#board');
    await screen.findByRole('heading', { name: 'Board playground (dev only)' });
  });

  it('matches a dev key ending in "=" as a prefix', async () => {
    mountAt('#lesson=rook&view=story');
    await screen.findByText('Lesson preview (dev only):');
  });

  it('boots the app for any other hash', async () => {
    mountAt('#unknown');
    await screen.findByRole('heading', { name: 'Chess for Kids' });
  });

  it('fails loudly without a root element', () => {
    document.body.innerHTML = '';
    expect(() => {
      mountApp({
        pack: chessWeb,
        app: CHESS_APP_CONFIG,
        registerSW: () => () => Promise.resolve(),
      });
    }).toThrow('#root');
  });
});
