import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '../app-i18n.ts';

// Vitest `setupFiles` (once per test file, before its tests run): i18next initialised with the
// math locale and the DOM unmounted after each test.
afterEach(cleanup);
