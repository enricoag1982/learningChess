import { defineConfig, globalIgnores } from 'eslint/config';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';

// Package boundaries (docs/refactor-v4.md §R4): platform packages (core, content, web) never reach
// a subject, platform-core / platform-content stay React-free, subject-chess's core, content and
// kind engines stay UI-free, and apps reach a package only through its `exports`. `chess.js` is
// only allowed in the rules adapter.
const CHESSJS_RULES = 'packages/subject-chess/src/core/chess/chessjs-rules*.ts';
const CHESS_JS = {
  name: 'chess.js',
  message: 'use ChessRules from @learn/subject-chess; chess.js stays behind the adapter',
};
const NO_SUBJECT = {
  group: ['@learn/subject-*', '**/subject-*/**'],
  message: 'platform packages never import a subject package',
};
const NO_DEEP_PATH = {
  group: ['@learn/*/src', '@learn/*/src/**', '**/packages/*/src/**'],
  message: 'apps reach a package only through its `exports`, never a deep `src` path',
};
const NO_REACT = { group: ['react*'], message: 'this package is React-free' };
const NO_WEB = {
  group: ['**/web/**', '@learn/platform-web'],
  message: 'chess core and content never import web code',
};
// Separate rule instance (typescript-eslint's) so it does not override the domain rule below.
const restrict = (patterns, { banChessJs = true } = {}) => ({
  '@typescript-eslint/no-restricted-imports': [
    'error',
    { paths: banChessJs ? [CHESS_JS] : [], patterns },
  ],
});

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
  { files: ['packages/**', 'apps/**'], ignores: [CHESSJS_RULES], rules: restrict([]) },
  {
    files: ['packages/platform-core/**'],
    rules: restrict([
      NO_SUBJECT,
      NO_REACT,
      {
        group: ['@learn/platform-web', '@learn/platform-content'],
        message: 'platform-core sits below platform-content and platform-web',
      },
    ]),
  },
  {
    files: ['packages/platform-content/**'],
    rules: restrict([
      NO_SUBJECT,
      NO_REACT,
      { group: ['@learn/platform-web'], message: 'platform-content sits below platform-web' },
    ]),
  },
  { files: ['packages/platform-web/**'], rules: restrict([NO_SUBJECT]) },
  { files: ['apps/**'], rules: restrict([NO_DEEP_PATH]) },
  {
    files: [
      'packages/subject-chess/src/core/**',
      'packages/subject-chess/src/content/**',
      'packages/subject-chess/src/kinds/*/{kind,engine,solution,content,verify}{,.test}.ts',
    ],
    ignores: [CHESSJS_RULES],
    rules: restrict([NO_REACT, NO_WEB]),
  },
  { files: [CHESSJS_RULES], rules: restrict([NO_REACT, NO_WEB], { banChessJs: false }) },
  {
    // The cast is needed where subject-chess's `ProfileSettings` augmentation is in the program and
    // unnecessary in platform-core's own program, where this file is linted.
    files: ['packages/platform-core/src/domain/profile-settings.ts'],
    rules: { '@typescript-eslint/no-unnecessary-type-assertion': 'off' },
  },
  {
    // The same reasoning for `SubjectRoutes`: chess augments it, so platform-web's own program has
    // it empty and `never` shows up in the route-name unions.
    files: ['packages/platform-web/src/app/routes.ts'],
    rules: { '@typescript-eslint/no-redundant-type-constituents': 'off' },
  },
  {
    files: [
      'packages/platform-core/src/domain/**',
      'packages/subject-chess/src/core/{chess,bot,game,variant,exercise}/**',
      'packages/subject-chess/src/kinds/**',
      'packages/subject-chess/src/modes/**',
    ],
    ignores: ['packages/subject-chess/src/{kinds,modes}/**/*.tsx'],
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
    files: [
      'apps/chess-kids/**/*.{ts,tsx}',
      'packages/platform-web/**/*.{ts,tsx}',
      'packages/subject-chess/src/{web,kinds,modes}/**/*.{ts,tsx}',
    ],
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
    // Neither app nor web code drives e2e or Playwright directly — only the registries' own `e2e.ts`
    // siblings and `e2e-actions.ts`/`e2e-registry.ts` do (`kinds/`, `modes/`), for the app's
    // `e2e/kit/*.ts`.
    files: [
      'apps/chess-kids/src/**/*.{ts,tsx}',
      'packages/platform-web/src/**/*.{ts,tsx}',
      'packages/subject-chess/src/web/**/*.{ts,tsx}',
      'packages/subject-chess/src/{kinds,modes}/**/*.tsx',
    ],
    ignores: [
      'apps/chess-kids/src/modes/e2e-registry.ts',
      'apps/chess-kids/src/modes/*/e2e.ts',
      'packages/subject-chess/src/web/kinds/e2e-actions.ts',
      'packages/subject-chess/src/web/kinds/e2e-registry.ts',
      'packages/subject-chess/src/web/modes/e2e-registry.ts',
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
