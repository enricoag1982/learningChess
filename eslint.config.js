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
  // Platform/chess boundary ratchet (docs/refactor-v4.md §R4): platform-bound paths (left) may not
  // import chess-bound paths (right) or `@chess-kids/core/chess`.
  ...(() => {
    const PLATFORM_BOUND_PATHS = [
      'packages/core/src/index.ts',
      'packages/core/src/domain/*.ts',
      'packages/core/src/domain/exercise/kind.ts',
      'packages/core/src/domain/exercise/mode.ts',
      'packages/core/src/domain/exercise/stars.ts',
      'packages/core/src/domain/exercise/modes/series/*.ts',
      'packages/core/src/app/assessment.ts',
      'packages/core/src/app/assessment.test.ts',
      'packages/core/src/app/backup.ts',
      'packages/core/src/app/backup.test.ts',
      'packages/core/src/app/device.ts',
      'packages/core/src/app/journey.ts',
      'packages/core/src/app/journey.test.ts',
      'packages/core/src/app/merge.ts',
      'packages/core/src/app/merge.test.ts',
      'packages/core/src/app/minigames.ts',
      'packages/core/src/app/minigames.test.ts',
      'packages/core/src/app/ports.ts',
      'packages/core/src/app/profiles.ts',
      'packages/core/src/app/profiles.test.ts',
      'packages/core/src/app/report.ts',
      'packages/core/src/app/report.test.ts',
      'packages/core/src/app/rewards.ts',
      'packages/core/src/app/rewards.test.ts',
      'packages/core/src/app/session.ts',
      'packages/core/src/app/session.test.ts',
      'packages/core/src/app/settings.ts',
      'packages/core/src/app/settings.test.ts',
      'packages/core/src/app/time-limit.ts',
      'packages/core/src/app/time-limit.test.ts',
      'packages/core/src/app/use-cases.ts',
      'packages/core/src/app/use-cases.test.ts',
      'packages/content/src/load.ts',
      'packages/content/src/load.test.ts',
      'packages/content/src/schema.ts',
      'packages/content/src/lesson-load.ts',
      'packages/content/src/lesson-load.test.ts',
      'packages/content/src/lesson-schema.ts',
      'packages/content/src/tracks-schema.ts',
      'packages/content/src/tracks-load.ts',
      'packages/content/src/tracks-load.test.ts',
      'packages/content/src/badges-schema.ts',
      'packages/content/src/badges-load.ts',
      'packages/content/src/badges-load.test.ts',
      'packages/content/src/compile-all.ts',
      'packages/content/src/voice-texts.ts',
      'packages/content/src/voice-texts.test.ts',
      'packages/content/src/kinds/compile-exercise.ts',
      'packages/content/src/kinds/kind-content.ts',
      'packages/content/src/modes/mode-content.ts',
      'packages/content/src/modes/common.ts',
      'packages/content/src/modes/series/content.ts',
    ];
    const CHESS_BOUND_PATTERNS = [
      '**/domain/chess/**',
      '**/domain/bot/**',
      '**/domain/game/**',
      '**/domain/variant/**',
      '**/exercise/types.ts',
      '**/exercise/state.ts',
      '**/exercise/hint.ts',
      '**/exercise/solver.ts',
      '**/exercise/apply-move.ts',
      '**/exercise/notes.ts',
      '**/exercise/index.ts',
      '**/exercise/kinds/**',
      '**/exercise/modes/index.ts',
      '**/exercise/modes/static/**',
      '**/exercise/modes/versus/**',
      '**/app/games.ts',
      '**/app/friend-play.ts',
      '**/app/bot-player.ts',
      '**/chess-core.ts',
      '**/content/src/chess-content.ts',
      '**/content/src/bot-book-load.ts',
      '**/content/src/bot-book-schema.ts',
      '**/content/src/kinds/common.ts',
      '**/content/src/kinds/index.ts',
      '**/content/src/kinds/best-move/**',
      '**/content/src/kinds/capture/**',
      '**/content/src/kinds/choice/**',
      '**/content/src/kinds/collect-stars/**',
      '**/content/src/kinds/mate-in-n/**',
      '**/content/src/kinds/select-squares/**',
      '**/content/src/kinds/setup/**',
      '**/content/src/kinds/yes-no/**',
      '**/content/src/modes/index.ts',
      '**/content/src/modes/static/**',
      '**/content/src/modes/versus/**',
    ];
    // Files still pending a chess-bound import fix; empty once the boundary holds everywhere.
    const RATCHET_IGNORES = [
      // `ContentSource` (`AppDeps.content`) is a build artifact carrier, not a subject-generic
      // port: the UI reads real board/exercise fields straight off it, so it stays concrete
      // (see the file's own comment) rather than forcing a cast onto every read site.
      'packages/core/src/app/ports.ts',
      'packages/core/src/app/use-cases.test.ts',
      'packages/core/src/app/minigames.test.ts',
      'packages/core/src/domain/exercise/modes/series/engine.test.ts',
    ];
    return [
      {
        files: PLATFORM_BOUND_PATHS,
        ignores: RATCHET_IGNORES,
        rules: {
          'no-restricted-imports': [
            'error',
            {
              paths: [
                {
                  name: '@chess-kids/core/chess',
                  message:
                    'platform-bound code cannot import chess-bound code (v4 pre-split ratchet)',
                },
              ],
              patterns: [
                {
                  group: CHESS_BOUND_PATTERNS,
                  message:
                    'platform-bound code cannot import chess-bound code (v4 pre-split ratchet)',
                },
              ],
            },
          ],
        },
      },
    ];
  })(),
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
