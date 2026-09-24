import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { compareToReference, loadLocales } from './load.ts';

const localesDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'locales');

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
