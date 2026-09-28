import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { initI18n } from '@learn/platform-web/i18n.ts';
import en from './dist/locales/en.json';

// Vitest `setupFiles` for the `web` (jsdom) project: same two things as
// `apps/chess-kids/src/testing/setup.ts` + `app-i18n.ts` — i18next initialised with the chess
// locale (built by `pnpm build`), and the DOM unmounted after each test.
initI18n({ en });
afterEach(cleanup);
