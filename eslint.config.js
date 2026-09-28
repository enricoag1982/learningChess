import { defineConfig, globalIgnores } from 'eslint/config';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';

// Web tests that genuinely exercise chess behaviour, exempted from the web platform/chess ratchet
// below rather than fixed on the platform's own base types/kit. They move to `apps/chess-kids`
// with the web package move.
const APP_INTEGRATION_TESTS = [
  // apps/chess-kids
  'apps/web/src/App.test.tsx',
  'apps/web/src/adapters/persistent-storage.test.ts',
  'apps/web/src/adapters/share-backup.test.ts',
  'apps/web/src/adapters/storage/local-backup-importer.test.ts',
  'apps/web/src/app/nav.test.ts',
  'apps/web/src/modes/series/Step.test.tsx',
  'apps/web/src/ui/Celebration.test.tsx',
  'apps/web/src/ui/DenScreen.test.tsx',
  'apps/web/src/ui/HomeScreen.test.tsx',
  'apps/web/src/ui/JourneyScreen.test.tsx',
  'apps/web/src/ui/LessonScreen.test.tsx',
  'apps/web/src/ui/PracticeScreen.test.tsx',
  'apps/web/src/ui/TimeTracker.test.tsx',
  'apps/web/src/ui/TodaySession.test.tsx',
  'apps/web/src/ui/art/animal-images.test.ts',
  'apps/web/src/ui/assessment-flow.test.tsx',
  'apps/web/src/ui/lesson/ExerciseStep.test.tsx',
  'apps/web/src/ui/parent-area-flow.test.tsx',
  'apps/web/src/ui/profiles-flow.test.tsx',
  'apps/web/src/ui/session/ReviewExerciseStep.test.tsx',
  'apps/web/src/ui/time-limit-flow.test.tsx',
];

// Package boundaries (docs/refactor-v4.md §R4): platform packages never reach a subject,
// platform-core / platform-content stay React-free, and subject-chess's core, content and kind
// engines stay UI-free. `chess.js` is only allowed in the rules adapter.
const CHESSJS_RULES = 'packages/subject-chess/src/core/chess/chessjs-rules*.ts';
const CHESS_JS = {
  name: 'chess.js',
  message: 'use ChessRules from @learn/subject-chess; chess.js stays behind the adapter',
};
const NO_SUBJECT = {
  group: ['@learn/subject-*', '**/subject-*/**'],
  message: 'platform packages never import a subject package',
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
    files: [
      'packages/platform-core/src/domain/**',
      'packages/subject-chess/src/core/{chess,bot,game,variant,exercise}/**',
      'packages/subject-chess/src/kinds/**',
      'packages/subject-chess/src/modes/**',
    ],
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
  // Web platform/chess boundary ratchet (docs/refactor-v4.md §R4 m8.17): platform-bound web
  // modules (left) may not import chess-bound web modules (right) or `@learn/subject-chess` —
  // every platform-bound module reaches chess only through the `SubjectWeb` pack.
  ...(() => {
    const PLATFORM_BOUND_WEB_PATHS = [
      'apps/web/src/App.test.tsx',
      'apps/web/src/App.tsx',
      'apps/web/src/adapters/app-update.test.ts',
      'apps/web/src/adapters/app-update.ts',
      'apps/web/src/adapters/clock.ts',
      'apps/web/src/adapters/content/bundled-content-source.test.ts',
      'apps/web/src/adapters/download-backup-file-writer.ts',
      'apps/web/src/adapters/download-password-file-writer.test.ts',
      'apps/web/src/adapters/download-password-file-writer.ts',
      'apps/web/src/adapters/ids.ts',
      'apps/web/src/adapters/install-banner.test.ts',
      'apps/web/src/adapters/install-banner.ts',
      'apps/web/src/adapters/narration/audio-narrator.test.ts',
      'apps/web/src/adapters/narration/audio-narrator.ts',
      'apps/web/src/adapters/narration/gated-narrator.test.ts',
      'apps/web/src/adapters/narration/gated-narrator.ts',
      'apps/web/src/adapters/narration/web-speech-narrator.test.ts',
      'apps/web/src/adapters/narration/web-speech-narrator.ts',
      'apps/web/src/adapters/persistent-storage.test.ts',
      'apps/web/src/adapters/persistent-storage.ts',
      'apps/web/src/adapters/random.ts',
      'apps/web/src/adapters/share-backup.test.ts',
      'apps/web/src/adapters/share-backup.ts',
      'apps/web/src/adapters/storage/collections.test.ts',
      'apps/web/src/adapters/storage/collections.ts',
      'apps/web/src/adapters/storage/local-assessment-repository.test.ts',
      'apps/web/src/adapters/storage/local-assessment-repository.ts',
      'apps/web/src/adapters/storage/local-backup-importer.test.ts',
      'apps/web/src/adapters/storage/local-backup-importer.ts',
      'apps/web/src/adapters/storage/local-game-record-repository.ts',
      'apps/web/src/adapters/storage/local-parent-lock-repository.test.ts',
      'apps/web/src/adapters/storage/local-parent-lock-repository.ts',
      'apps/web/src/adapters/storage/local-profile-repository.test.ts',
      'apps/web/src/adapters/storage/local-profile-repository.ts',
      'apps/web/src/adapters/storage/local-progress-repository.test.ts',
      'apps/web/src/adapters/storage/local-progress-repository.ts',
      'apps/web/src/adapters/storage/local-rewards-repository.test.ts',
      'apps/web/src/adapters/storage/local-rewards-repository.ts',
      'apps/web/src/adapters/storage/local-settings-repository.test.ts',
      'apps/web/src/adapters/storage/local-settings-repository.ts',
      'apps/web/src/adapters/storage/local-store.test.ts',
      'apps/web/src/adapters/storage/local-store.ts',
      'apps/web/src/adapters/storage/migrations.test.ts',
      'apps/web/src/adapters/storage/migrations.ts',
      'apps/web/src/adapters/storage/storage-keys.ts',
      'apps/web/src/app-version.d.ts',
      'apps/web/src/app/nav.test.ts',
      'apps/web/src/app/routes.ts',
      'apps/web/src/app/services.ts',
      'apps/web/src/app/slices/learn.ts',
      'apps/web/src/app/slices/nav.ts',
      'apps/web/src/app/slices/profile.ts',
      'apps/web/src/app/slices/rewards.ts',
      'apps/web/src/app/slices/time.ts',
      'apps/web/src/app/slices/today.ts',
      'apps/web/src/app/store.ts',
      'apps/web/src/content-text.ts',
      'apps/web/src/i18n-options.ts',
      'apps/web/src/i18n.ts',
      'apps/web/src/i18next.d.ts',
      'apps/web/src/kinds/ExerciseControls.tsx',
      'apps/web/src/kinds/ExercisePlay.tsx',
      'apps/web/src/kinds/kind-ui.ts',
      'apps/web/src/kinds/panel-body.tsx',
      'apps/web/src/kinds/session.ts',
      'apps/web/src/modes/boss-run.tsx',
      'apps/web/src/modes/mode-ui.ts',
      'apps/web/src/modes/series/Step.test.tsx',
      'apps/web/src/modes/series/Step.tsx',
      'apps/web/src/modes/series/e2e.ts',
      'apps/web/src/testing/app-test-helpers.ts',
      'apps/web/src/testing/fake-backup-file-writer.ts',
      'apps/web/src/testing/fake-narrator.ts',
      'apps/web/src/testing/fake-password-file-writer.ts',
      'apps/web/src/testing/memory-storage.ts',
      'apps/web/src/testing/mock-media-query.ts',
      'apps/web/src/testing/render-app.tsx',
      'apps/web/src/testing/render-with-store.tsx',
      'apps/web/src/testing/setup.ts',
      'apps/web/src/ui/AppErrorBoundary.tsx',
      'apps/web/src/ui/AppNotice.tsx',
      'apps/web/src/ui/AppUpdater.tsx',
      'apps/web/src/ui/AssessmentScreen.tsx',
      'apps/web/src/ui/BadgeIcon.tsx',
      'apps/web/src/ui/Celebration.test.tsx',
      'apps/web/src/ui/Celebration.tsx',
      'apps/web/src/ui/DenScreen.test.tsx',
      'apps/web/src/ui/DenScreen.tsx',
      'apps/web/src/ui/FirstRunScreen.tsx',
      'apps/web/src/ui/HomeScreen.test.tsx',
      'apps/web/src/ui/HomeScreen.tsx',
      'apps/web/src/ui/InstallBanner.tsx',
      'apps/web/src/ui/JourneyScreen.test.tsx',
      'apps/web/src/ui/JourneyScreen.tsx',
      'apps/web/src/ui/LazyFallback.tsx',
      'apps/web/src/ui/LessonScreen.test.tsx',
      'apps/web/src/ui/LessonScreen.tsx',
      'apps/web/src/ui/MiniGameSessionScreen.tsx',
      'apps/web/src/ui/NewPlayerScreen.tsx',
      'apps/web/src/ui/ParentAreaScreen.tsx',
      'apps/web/src/ui/PasswordScreen.tsx',
      'apps/web/src/ui/PlacementOfferScreen.tsx',
      'apps/web/src/ui/PlacementScreen.tsx',
      'apps/web/src/ui/PracticeRunScreen.tsx',
      'apps/web/src/ui/PracticeScreen.test.tsx',
      'apps/web/src/ui/PracticeScreen.tsx',
      'apps/web/src/ui/ProfilePickerScreen.tsx',
      'apps/web/src/ui/RankPill.tsx',
      'apps/web/src/ui/SessionSummaryScreen.tsx',
      'apps/web/src/ui/StarsPill.tsx',
      'apps/web/src/ui/StarsRow.tsx',
      'apps/web/src/ui/StreakPill.tsx',
      'apps/web/src/ui/TestOutSheet.tsx',
      'apps/web/src/ui/TimeLimitScreen.tsx',
      'apps/web/src/ui/TimeTracker.test.tsx',
      'apps/web/src/ui/TimeTracker.tsx',
      'apps/web/src/ui/TodaySession.test.tsx',
      'apps/web/src/ui/WarmUpScreen.tsx',
      'apps/web/src/ui/art/animal-images.test.ts',
      'apps/web/src/ui/art/animal-images.ts',
      'apps/web/src/ui/art/avatar-meta.ts',
      'apps/web/src/ui/art/avatars.tsx',
      'apps/web/src/ui/art/characters.tsx',
      'apps/web/src/ui/assessment-flow.test.tsx',
      'apps/web/src/ui/ds/AvatarBadge.tsx',
      'apps/web/src/ui/ds/ConfirmDialog.tsx',
      'apps/web/src/ui/ds/NarratedBubble.tsx',
      'apps/web/src/ui/ds/Owl.tsx',
      'apps/web/src/ui/ds/ReplayButton.tsx',
      'apps/web/src/ui/ds/Screen.tsx',
      'apps/web/src/ui/ds/SpeechBubble.tsx',
      'apps/web/src/ui/ds/icons-lazy.tsx',
      'apps/web/src/ui/ds/icons.tsx',
      'apps/web/src/ui/ds/parent-styles-lazy.ts',
      'apps/web/src/ui/ds/parent.tsx',
      'apps/web/src/ui/ds/primitives-styles.ts',
      'apps/web/src/ui/ds/primitives.test.tsx',
      'apps/web/src/ui/ds/primitives.tsx',
      'apps/web/src/ui/ds/speakSequence.test.ts',
      'apps/web/src/ui/ds/speakSequence.ts',
      'apps/web/src/ui/ds/tap.ts',
      'apps/web/src/ui/ds/useAsync.ts',
      'apps/web/src/ui/ds/useNarratedText.test.tsx',
      'apps/web/src/ui/ds/useNarratedText.ts',
      'apps/web/src/ui/lesson-character-labels.ts',
      'apps/web/src/ui/lesson/CharacterCard.tsx',
      'apps/web/src/ui/lesson/CompleteStep.tsx',
      'apps/web/src/ui/lesson/DemoStep.tsx',
      'apps/web/src/ui/lesson/ExerciseStep.test.tsx',
      'apps/web/src/ui/lesson/ExerciseStep.tsx',
      'apps/web/src/ui/lesson/GameLayout.tsx',
      'apps/web/src/ui/lesson/NextButton.tsx',
      'apps/web/src/ui/lesson/PhaseChip.test.tsx',
      'apps/web/src/ui/lesson/PhaseChip.tsx',
      'apps/web/src/ui/lesson/SkipButton.tsx',
      'apps/web/src/ui/lesson/StepPills.tsx',
      'apps/web/src/ui/lesson/StoryStep.tsx',
      'apps/web/src/ui/lesson/button-styles.ts',
      'apps/web/src/ui/lesson/exercise-text.ts',
      'apps/web/src/ui/lesson/phase-track.ts',
      'apps/web/src/ui/parent-area-flow.test.tsx',
      'apps/web/src/ui/parent/BackupPanel.tsx',
      'apps/web/src/ui/parent/ChildReport.tsx',
      'apps/web/src/ui/parent/ChildSettings.tsx',
      'apps/web/src/ui/parent/PrivacyPolicy.tsx',
      'apps/web/src/ui/parent/PrivacyScreen.tsx',
      'apps/web/src/ui/parent/UnlockPanel.tsx',
      'apps/web/src/ui/parent/countdown.test.ts',
      'apps/web/src/ui/parent/countdown.ts',
      'apps/web/src/ui/parent/parent-styles.ts',
      'apps/web/src/ui/profiles-flow.test.tsx',
      'apps/web/src/ui/session/ReviewExerciseStep.test.tsx',
      'apps/web/src/ui/session/ReviewExerciseStep.tsx',
      'apps/web/src/ui/session/ReviewTaskRunner.tsx',
      'apps/web/src/ui/time-limit-flow.test.tsx',
      'apps/web/src/ui/useMediaQuery.ts',
    ];
    const CHESS_BOUND_WEB_PATTERNS = [
      '**/kinds/best-move/**',
      '**/kinds/capture/**',
      '**/kinds/choice/**',
      '**/kinds/collect-stars/**',
      '**/kinds/mate-in-n/**',
      '**/kinds/select-squares/**',
      '**/kinds/setup/**',
      '**/kinds/yes-no/**',
      '**/kinds/MoveBoard.tsx',
      '**/kinds/MoveCountedPlayArea.tsx',
      '**/kinds/move-ui.ts',
      '**/kinds/e2e-actions.ts',
      '**/kinds/e2e-registry.ts',
      '**/kinds/ui-registry.ts',
      '**/modes/static/**',
      '**/modes/versus/**',
      '**/modes/ui-registry.ts',
      '**/modes/e2e-registry.ts',
      '**/ui/board/**',
      '**/ui/PlayScreen.tsx',
      '**/ui/PlayScreen.test.tsx',
      '**/ui/FullGameScreen.tsx',
      '**/ui/FullGameScreen.test.tsx',
      '**/ui/FriendSetupScreen.tsx',
      '**/ui/FriendGameScreen.tsx',
      '**/ui/FriendPlay.test.tsx',
      '**/ui/art/character-meta.ts',
      '**/app/slices/play.ts',
      '**/adapters/bot/**',
      '**/dev/BoardPlayground.tsx',
      '**/dev/ExercisePlayground.tsx',
      '**/dev/LessonPreview.tsx',
      '**/testing/board.ts',
      '**/testing/bot.ts',
      '**/testing/fixtures.ts',
      '**/testing/test-services.ts',
    ];
    return [
      {
        files: PLATFORM_BOUND_WEB_PATHS,
        ignores: APP_INTEGRATION_TESTS,
        rules: {
          // Separate rule instance (typescript-eslint's) so the later e2e-import-restriction
          // block below (plain `no-restricted-imports`, same `apps/web/src/**` files) does not
          // overwrite this one — flat config replaces same-named rules per matching file.
          '@typescript-eslint/no-restricted-imports': [
            'error',
            {
              paths: [
                CHESS_JS,
                {
                  name: '@learn/subject-chess',
                  message:
                    'platform-bound web code cannot import chess-bound code — reach chess only through the SubjectWeb pack',
                },
              ],
              patterns: [
                {
                  group: CHESS_BOUND_WEB_PATTERNS,
                  message:
                    'platform-bound web code cannot import chess-bound web code — reach chess only through the SubjectWeb pack',
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
