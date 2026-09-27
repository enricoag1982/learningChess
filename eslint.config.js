import { defineConfig, globalIgnores } from 'eslint/config';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';

export default defineConfig([
  globalIgnores([
    '**/dist/**',
    '**/dev-dist/**',
    '**/coverage/**',
    '**/playwright-report/**',
    '**/test-results/**',
    '.claude/**',
  ]),
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['*.js'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    // Separate rule instance (typescript-eslint's) so it does not override the domain rule below.
    files: ['packages/**', 'apps/**'],
    ignores: ['packages/core/src/domain/chess/chessjs-rules*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'chess.js',
              message: 'use ChessRules from @chess-kids/core; chess.js stays behind the adapter',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/core/src/domain/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/app/**', '**/adapters/**', 'react', 'react-dom', 'react/*'],
              message: 'domain is pure TS: no app, adapter or UI imports',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat['recommended-latest'], reactRefresh.configs.vite],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // `useAsync` (ui/ds/useAsync.ts) takes its own `deps` array, same shape as useEffect's.
      'react-hooks/exhaustive-deps': ['warn', { additionalHooks: '(useAsync)' }],
    },
  },
  {
    // App code never drives e2e or Playwright directly — only the registries' own `e2e.ts`
    // siblings and `e2e-actions.ts`/`e2e-registry.ts` do (`kinds/`, `modes/`), for `e2e/kit/*.ts`.
    files: ['apps/web/src/**/*.{ts,tsx}'],
    ignores: [
      'apps/web/src/kinds/e2e-actions.ts',
      'apps/web/src/kinds/e2e-registry.ts',
      'apps/web/src/kinds/*/e2e.ts',
      'apps/web/src/modes/e2e-registry.ts',
      'apps/web/src/modes/*/e2e.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/e2e.ts', '**/sample.ts', '@playwright/test'],
              message: 'app code never imports an e2e driver, a dev sample or Playwright directly',
            },
          ],
        },
      ],
    },
  },
]);
