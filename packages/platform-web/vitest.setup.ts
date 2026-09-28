import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Vitest `setupFiles` (once per test file, before its tests run): every RTL test needs its DOM
// unmounted after each test. `apps/chess-kids/src/testing/setup.ts` also initialises i18next with
// the chess locale, so tests that need translated text stay in the app until a platform locale
// exists here.
afterEach(cleanup);
