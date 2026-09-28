import { describe, expect, it } from 'vitest';
import { compareToReference, loadLocales } from '@learn/platform-content/load';
import { PLATFORM_LOCALES_DIR } from '@learn/platform-content/paths';

const localesDir = PLATFORM_LOCALES_DIR;

describe('real locales directory', () => {
  it('loads without issues', () => {
    expect(() => loadLocales(localesDir)).not.toThrow();
  });

  it('has an en/common namespace with app.title', () => {
    const locales = loadLocales(localesDir);
    expect(locales.en?.common?.app).toEqual({ title: 'Chess for Kids' });
  });

  it('has no divergence from the reference language', () => {
    const locales = loadLocales(localesDir);
    expect(compareToReference(locales)).toEqual([]);
  });
});
