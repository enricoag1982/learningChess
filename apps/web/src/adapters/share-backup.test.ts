import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createProfile } from '@chess-kids/core';
import { createTestServices } from '../testing/test-services.ts';
import { fixtureContentSource, fixtureLesson } from '../testing/fixtures.ts';
import { sendBackupToOtherDevice } from './share-backup.ts';

// jsdom does not implement Blob URLs; stub them so the download fallback can run under vitest
// (same pattern `download-password-file-writer.test.ts` uses).
let createObjectURL: ReturnType<typeof vi.fn>;
let revokeObjectURL: ReturnType<typeof vi.fn>;

beforeEach(() => {
  createObjectURL = vi.fn(() => 'blob:fake-url');
  revokeObjectURL = vi.fn();
  vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function services(): ReturnType<typeof createTestServices> {
  return createTestServices(fixtureContentSource(fixtureLesson()));
}

describe('sendBackupToOtherDevice', () => {
  it('shares a File via navigator.share when the browser can share files', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const canShare = vi.fn().mockReturnValue(true);
    vi.stubGlobal('navigator', Object.assign({}, navigator, { share, canShare }));
    const { deps } = services();
    await createProfile(deps, 'Mia', 'fox');

    const outcome = await sendBackupToOtherDevice(deps);

    expect(outcome).toBe('shared');
    expect(canShare).toHaveBeenCalledTimes(1);
    expect(share).toHaveBeenCalledTimes(1);
    const [payload] = share.mock.calls[0] as [{ files: File[]; title: string }];
    expect(payload.files).toHaveLength(1);
    expect(payload.files[0]?.name).toMatch(/^chess-for-kids-all-\d{4}-\d{2}-\d{2}\.json$/);
    expect(createObjectURL).not.toHaveBeenCalled(); // no download fallback triggered
  });

  it('names the file after the one profile when sharing just that child', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const canShare = vi.fn().mockReturnValue(true);
    vi.stubGlobal('navigator', Object.assign({}, navigator, { share, canShare }));
    const { deps } = services();
    const mia = await createProfile(deps, 'Mia', 'fox');

    await sendBackupToOtherDevice(deps, [mia.id]);

    const [payload] = share.mock.calls[0] as [{ files: File[] }];
    expect(payload.files[0]?.name).toMatch(/^chess-for-kids-mia-\d{4}-\d{2}-\d{2}\.json$/);
  });

  it('falls back to download when the browser has no navigator.share at all (Safari 15.4)', async () => {
    vi.stubGlobal(
      'navigator',
      Object.assign({}, navigator, { share: undefined, canShare: undefined }),
    );
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    const { deps } = services();

    const outcome = await sendBackupToOtherDevice(deps);

    expect(outcome).toBe('downloaded');
    expect(clickSpy).toHaveBeenCalledTimes(1);
    const anchor = clickSpy.mock.instances[0] as HTMLAnchorElement;
    expect(anchor.download).toMatch(/^chess-for-kids-all-\d{4}-\d{2}-\d{2}\.json$/);
  });

  it('falls back to download when the browser cannot share this particular file', async () => {
    const share = vi.fn();
    const canShare = vi.fn().mockReturnValue(false);
    vi.stubGlobal('navigator', Object.assign({}, navigator, { share, canShare }));
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    const { deps } = services();

    const outcome = await sendBackupToOtherDevice(deps);

    expect(outcome).toBe('downloaded');
    expect(share).not.toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('is silent on a user cancel (AbortError) — no download fallback', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('cancelled', 'AbortError'));
    const canShare = vi.fn().mockReturnValue(true);
    vi.stubGlobal('navigator', Object.assign({}, navigator, { share, canShare }));
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    const { deps } = services();

    const outcome = await sendBackupToOtherDevice(deps);

    expect(outcome).toBe('cancelled');
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('falls back to download on any other share error', async () => {
    const share = vi.fn().mockRejectedValue(new Error('OS share sheet failed'));
    const canShare = vi.fn().mockReturnValue(true);
    vi.stubGlobal('navigator', Object.assign({}, navigator, { share, canShare }));
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    const { deps } = services();

    const outcome = await sendBackupToOtherDevice(deps);

    expect(outcome).toBe('downloaded');
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });
});
