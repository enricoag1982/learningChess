import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createProfile } from '@chess-kids/core';
import '../i18n.ts';
import App from '../App.tsx';
import { createBundledContentSource } from '../adapters/content/bundled-content-source.ts';
import { createTestServices } from '../testing/test-services.ts';
import {
  pickProfileFromPicker,
  seedReturningProfile,
  seedWorldFourMastered,
} from '../testing/app-test-helpers.ts';
import type { Services } from '../app/services.ts';

afterEach(cleanup);

function createServicesWithRealContent(): Services {
  return createTestServices(createBundledContentSource());
}

/** Clicks the board cell named "<square>, ..." (Board.tsx's accessible square names). */
function clickSquare(square: string): void {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${square},`) }));
}

/** Seeds Mia (active, World 4 mastered — unlocks every vs Friend game) and Ben (second player,
 * no progress needed: only the active profile's own unlocks decide what the setup sheet offers). */
async function seedTwoProfiles(services: Services): Promise<{ miaId: string; benId: string }> {
  const mia = await seedReturningProfile(services, 'Mia');
  await seedWorldFourMastered(services, mia.id);
  const ben = await createProfile(services.deps, 'Ben', 'bear');
  return { miaId: mia.id, benId: ben.id };
}

/** From Home: Play → vs Friend → setup sheet. */
async function openFriendSetup(): Promise<void> {
  fireEvent.click(await screen.findByRole('button', { name: 'Play' }));
  await screen.findByRole('heading', { name: 'Play' });
  fireEvent.click(screen.getByRole('button', { name: 'vs Friend' }));
  await screen.findByRole('heading', { name: 'vs Friend' });
}

/** Setup sheet: picks Ben, Full Game, and the given board mode, then starts the match. */
async function startFriendGame(boardMode: 'Pass and play' | 'Face to face'): Promise<void> {
  fireEvent.click(screen.getByRole('button', { name: 'Ben' }));
  fireEvent.click(screen.getByRole('button', { name: 'Full Game' }));
  fireEvent.click(screen.getByRole('button', { name: boardMode }));
  fireEvent.click(screen.getByRole('button', { name: 'Start' }));
  await waitFor(() => {
    expect(screen.getByRole('button', { name: /^e2,/ })).toBeTruthy();
  });
}

describe('FriendSetupScreen (M4.3)', () => {
  it('offers the second-player and game choices, and enables Start once both are picked', async () => {
    const services = createServicesWithRealContent();
    await seedTwoProfiles(services);
    render(<App services={services} />);
    await pickProfileFromPicker('Mia');
    await openFriendSetup();

    expect(screen.getByRole('button', { name: 'Ben' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Guest' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Full Game' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Pawn Wars' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Win the Queen' })).toBeTruthy();

    const start = screen.getByRole('button', { name: 'Start' });
    expect(start).toHaveProperty('disabled', true);

    fireEvent.click(screen.getByRole('button', { name: 'Ben' }));
    expect(start).toHaveProperty('disabled', true);
    fireEvent.click(screen.getByRole('button', { name: 'Full Game' }));
    expect(start).toHaveProperty('disabled', false);

    fireEvent.click(start);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^e2,/ })).toBeTruthy();
    });
  });

  it('vs Friend is locked until the active profile has any game unlocked', async () => {
    const services = createServicesWithRealContent();
    // Mia has no progress at all: no full game, no versus mini-game unlocked yet.
    await seedReturningProfile(services, 'Mia');
    render(<App services={services} />);
    await pickProfileFromPicker('Mia');
    fireEvent.click(await screen.findByRole('button', { name: 'Play' }));
    await screen.findByRole('heading', { name: 'Play' });

    fireEvent.click(screen.getByRole('button', { name: /vs Friend/ }));
    expect(screen.queryByRole('heading', { name: 'vs Friend' })).toBeNull();
    expect(screen.getAllByText('Finish more lessons first').length).toBeGreaterThan(0);
  });
});

describe('FriendGameScreen — board modes (M4.3)', () => {
  it("face-to-face rotates the top (black) side's pieces and strip", async () => {
    const services = createServicesWithRealContent();
    await seedTwoProfiles(services);
    render(<App services={services} />);
    await pickProfileFromPicker('Mia');
    await openFriendSetup();
    await startFriendGame('Face to face');

    // Black's queen (d8, start position) is drawn rotated; White's (d1) is not.
    const d8 = screen.getByRole('button', { name: /^d8, black queen/ });
    expect(d8.querySelector('.rotate-180')).not.toBeNull();
    const d1 = screen.getByRole('button', { name: /^d1, white queen/ });
    expect(d1.querySelector('.rotate-180')).toBeNull();

    // Black's own control strip is rotated too.
    expect(screen.getByText('Ben').closest('.rotate-180')).not.toBeNull();
  });

  it('pass-and-play flips the board to face the player to move', async () => {
    const services = createServicesWithRealContent();
    await seedTwoProfiles(services);
    render(<App services={services} />);
    await pickProfileFromPicker('Mia');
    await openFriendSetup();
    await startFriendGame('Pass and play');

    // White's turn: a8 (black rook) is the visual top-left square.
    const gridBefore = screen.getAllByRole('gridcell');
    expect(
      within(gridBefore[0] as HTMLElement)
        .getByRole('button')
        .getAttribute('aria-label'),
    ).toMatch(/^a8,/);

    clickSquare('e2');
    clickSquare('e4');
    await screen.findByRole('button', { name: /^e4, white pawn/ });

    // Black's turn now: the board has flipped, so h1 (white rook) is the visual top-left square.
    const gridAfter = screen.getAllByRole('gridcell');
    expect(
      within(gridAfter[0] as HTMLElement)
        .getByRole('button')
        .getAttribute('aria-label'),
    ).toMatch(/^h1,/);
  });
});

describe('FriendGameScreen — take back (M4.3)', () => {
  it('asks the player to move; declining keeps the move, accepting undoes it', async () => {
    const services = createServicesWithRealContent();
    await seedTwoProfiles(services);
    render(<App services={services} />);
    await pickProfileFromPicker('Mia');
    await openFriendSetup();
    await startFriendGame('Pass and play');

    clickSquare('e2');
    clickSquare('e4');
    await screen.findByRole('button', { name: /^e4, white pawn/ });

    // White (Mia) just moved, so it is Ben's turn — take back asks Ben for permission.
    fireEvent.click(screen.getByRole('button', { name: 'Take back' }));
    await screen.findByRole('alertdialog', { name: 'Allow take back?' });
    expect(screen.getByText('Ask Ben: Allow take back?')).toBeTruthy();

    // Decline: the move stands.
    fireEvent.click(screen.getByRole('button', { name: 'No' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getByRole('button', { name: /^e4, white pawn/ })).toBeTruthy();

    // Ask again, this time accepting: the pawn is back on e2.
    fireEvent.click(screen.getByRole('button', { name: 'Take back' }));
    await screen.findByRole('alertdialog', { name: 'Allow take back?' });
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    await screen.findByRole('button', { name: /^e2, white pawn/ });
    expect(screen.getByRole('button', { name: /^e4, empty/ })).toBeTruthy();
  });
});

describe('FriendGameScreen — stop (M4.3)', () => {
  it('confirms before stopping; confirming records "abandoned" for both profiles', async () => {
    const services = createServicesWithRealContent();
    const { miaId, benId } = await seedTwoProfiles(services);
    render(<App services={services} />);
    await pickProfileFromPicker('Mia');
    await openFriendSetup();
    await startFriendGame('Pass and play');

    clickSquare('e2');
    clickSquare('e4');
    await screen.findByRole('button', { name: /^e4, white pawn/ });

    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    await screen.findByRole('alertdialog', { name: 'Stop this game?' });

    fireEvent.click(screen.getByRole('button', { name: 'Keep playing' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    await screen.findByRole('alertdialog', { name: 'Stop this game?' });
    fireEvent.click(screen.getByRole('button', { name: 'Stop game' }));

    await screen.findByRole('heading', { name: 'Play' });
    await waitFor(async () => {
      const miaRecords = await services.deps.gameRecords.listByProfile(miaId);
      expect(miaRecords.some((record) => record.result === 'abandoned')).toBe(true);
    });
    const [miaRecord] = await services.deps.gameRecords.listByProfile(miaId);
    const [benRecord] = await services.deps.gameRecords.listByProfile(benId);
    expect(miaRecord).toMatchObject({
      opponent: `profile:${benId}`,
      result: 'abandoned',
      reason: 'left',
    });
    expect(benRecord).toMatchObject({
      opponent: `profile:${miaId}`,
      result: 'abandoned',
      reason: 'left',
    });
  });
});

describe('FriendGameScreen — result (M4.3)', () => {
  it("Scholar's mate names the winner by nickname and saves both profiles' records", async () => {
    const services = createServicesWithRealContent();
    const { miaId, benId } = await seedTwoProfiles(services);
    render(<App services={services} />);
    await pickProfileFromPicker('Mia');
    await openFriendSetup();
    await startFriendGame('Pass and play');

    // 1.e4 e5 2.Qh5 Nc6 3.Bc4 Nf6?? 4.Qxf7# (Scholar's mate) — Mia plays White by default.
    clickSquare('e2');
    clickSquare('e4');
    await screen.findByRole('button', { name: /^e4, white pawn/ });
    clickSquare('e7');
    clickSquare('e5');
    await screen.findByRole('button', { name: /^e5, black pawn/ });
    clickSquare('d1');
    clickSquare('h5');
    await screen.findByRole('button', { name: /^h5, white queen/ });
    clickSquare('b8');
    clickSquare('c6');
    await screen.findByRole('button', { name: /^c6, black knight/ });
    clickSquare('f1');
    clickSquare('c4');
    await screen.findByRole('button', { name: /^c4, white bishop/ });
    clickSquare('g8');
    clickSquare('f6');
    await screen.findByRole('button', { name: /^f6, black knight/ });
    clickSquare('h5');
    clickSquare('f7');

    await screen.findByText('Mia wins!');

    await waitFor(async () => {
      const miaRecords = await services.deps.gameRecords.listByProfile(miaId);
      expect(miaRecords.some((record) => record.result === 'win')).toBe(true);
    });
    const [miaRecord] = await services.deps.gameRecords.listByProfile(miaId);
    const [benRecord] = await services.deps.gameRecords.listByProfile(benId);
    expect(miaRecord).toMatchObject({
      game: 'full',
      opponent: `profile:${benId}`,
      result: 'win',
      reason: 'checkmate',
    });
    expect(benRecord).toMatchObject({
      game: 'full',
      opponent: `profile:${miaId}`,
      result: 'loss',
      reason: 'checkmate',
    });

    fireEvent.click(screen.getByRole('button', { name: 'Back to Play' }));
    await screen.findByRole('heading', { name: 'Play' });
  });
});
