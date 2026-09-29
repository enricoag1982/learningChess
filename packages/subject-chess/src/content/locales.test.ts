import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { compareToReference, loadLocales, mergeLocales } from '@learn/platform-content/load';
import { PLATFORM_LOCALES_DIR } from '@learn/platform-content/paths';

const chessLocalesDir = fileURLToPath(new URL('../../content/locales', import.meta.url));

function merged() {
  return mergeLocales(loadLocales(PLATFORM_LOCALES_DIR), loadLocales(chessLocalesDir));
}

describe('real locales directories', () => {
  it('load without issues', () => {
    expect(() => loadLocales(PLATFORM_LOCALES_DIR)).not.toThrow();
    expect(() => loadLocales(chessLocalesDir)).not.toThrow();
  });

  it('merge to an en/common namespace with app.title', () => {
    expect(merged().en?.common?.app).toEqual({ title: 'Chess for Kids' });
  });

  it('have no divergence from the reference language', () => {
    expect(compareToReference(merged())).toEqual([]);
  });
});
