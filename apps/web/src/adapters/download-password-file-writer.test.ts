import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDownloadPasswordFileWriter } from './download-password-file-writer.ts';

// jsdom does not implement Blob URLs; stub them so the adapter can run under vitest. Local
// variables (not `URL.createObjectURL` property access) so assertions don't trip
// @typescript-eslint/unbound-method.
let createObjectURL: ReturnType<typeof vi.fn>;
let revokeObjectURL: ReturnType<typeof vi.fn>;

beforeEach(() => {
  createObjectURL = vi.fn(() => 'blob:fake-url');
  revokeObjectURL = vi.fn();
  vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createDownloadPasswordFileWriter', () => {
  it('triggers a download named chess-for-kids-parent-code.txt and reports its location', async () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
      // jsdom does not implement navigation; only the trigger matters here.
    });
    const writer = createDownloadPasswordFileWriter();

    const result = await writer.write('1234');

    expect(result).toEqual({ location: 'Downloads/chess-for-kids-parent-code.txt' });
    expect(clickSpy).toHaveBeenCalledTimes(1);
    const anchor = clickSpy.mock.instances[0] as HTMLAnchorElement;
    expect(anchor.download).toBe('chess-for-kids-parent-code.txt');
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake-url');

    clickSpy.mockRestore();
  });

  it('includes the password in the file text passed to the Blob', async () => {
    const blobSpy = vi.spyOn(globalThis, 'Blob');
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const writer = createDownloadPasswordFileWriter();

    await writer.write('secret1');

    const [parts] = blobSpy.mock.calls[0] as [string[]];
    expect(parts.join('')).toContain('secret1');
    blobSpy.mockRestore();
    vi.restoreAllMocks();
  });
});
