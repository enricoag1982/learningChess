import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '../i18n.ts';

// Vitest `setupFiles` (once per test file, before its tests run): every RTL test needs i18next
// initialised and its DOM unmounted after each test, so this replaces the same two lines copied
// into every UI test file.
afterEach(cleanup);
