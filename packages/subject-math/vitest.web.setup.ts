import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { initI18n } from '@learn/platform-web/i18n.ts';
import en from './dist/locales/en.json';

// Vitest `setupFiles` for the `web` (jsdom) project: i18next initialised with the math locale (built by
// `pnpm build`), and the DOM unmounted after each test.
initI18n({ en });
afterEach(cleanup);
