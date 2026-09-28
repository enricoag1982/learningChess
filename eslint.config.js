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
  'apps/chess-kids/src/App.test.tsx',
  'apps/chess-kids/src/adapters/persistent-storage.test.ts',
  'apps/chess-kids/src/adapters/share-backup.test.ts',
  'apps/chess-kids/src/adapters/storage/local-backup-importer.test.ts',
  'apps/chess-kids/src/app/nav.test.ts',
  'apps/chess-kids/src/modes/series/Step.test.tsx',
  'apps/chess-kids/src/ui/Celebration.test.tsx',
  'apps/chess-kids/src/ui/DenScreen.test.tsx',
  'apps/chess-kids/src/ui/HomeScreen.test.tsx',
  'apps/chess-kids/src/ui/JourneyScreen.test.tsx',
  'apps/chess-kids/src/ui/LessonScreen.test.tsx',
  'apps/chess-kids/src/ui/PracticeScreen.test.tsx',
  'apps/chess-kids/src/ui/TimeTracker.test.tsx',
  'apps/chess-kids/src/ui/TodaySession.test.tsx',
  'apps/chess-kids/src/ui/art/animal-images.test.ts',
  'apps/chess-kids/src/ui/assessment-flow.test.tsx',
  'apps/chess-kids/src/ui/lesson/ExerciseStep.test.tsx',
  'apps/chess-kids/src/ui/parent-area-flow.test.tsx',
  'apps/chess-kids/src/ui/profiles-flow.test.tsx',
  'apps/chess-kids/src/ui/session/ReviewExerciseStep.test.tsx',
  'apps/chess-kids/src/ui/time-limit-flow.test.tsx',
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
      'apps/chess-kids/src/App.test.tsx',
      'apps/chess-kids/src/App.tsx',
      'apps/chess-kids/src/adapters/app-update.test.ts',
      'apps/chess-kids/src/adapters/app-update.ts',
      'apps/chess-kids/src/adapters/clock.ts',
      'apps/chess-kids/src/adapters/content/bundled-content-source.test.ts',
      'apps/chess-kids/src/adapters/download-backup-file-writer.ts',
      'apps/chess-kids/src/adapters/download-password-file-writer.test.ts',
      'apps/chess-kids/src/adapters/download-password-file-writer.ts',
      'apps/chess-kids/src/adapters/ids.ts',
      'apps/chess-kids/src/adapters/install-banner.test.ts',
      'apps/chess-kids/src/adapters/install-banner.ts',
      'apps/chess-kids/src/adapters/narration/audio-narrator.test.ts',
      'apps/chess-kids/src/adapters/narration/audio-narrator.ts',
      'apps/chess-kids/src/adapters/narration/gated-narrator.test.ts',
      'apps/chess-kids/src/adapters/narration/gated-narrator.ts',
      'apps/chess-kids/src/adapters/narration/web-speech-narrator.test.ts',
      'apps/chess-kids/src/adapters/narration/web-speech-narrator.ts',
      'apps/chess-kids/src/adapters/persistent-storage.test.ts',
      'apps/chess-kids/src/adapters/persistent-storage.ts',
      'apps/chess-kids/src/adapters/random.ts',
      'apps/chess-kids/src/adapters/share-backup.test.ts',
      'apps/chess-kids/src/adapters/share-backup.ts',
      'apps/chess-kids/src/adapters/storage/collections.test.ts',
      'apps/chess-kids/src/adapters/storage/collections.ts',
      'apps/chess-kids/src/adapters/storage/local-assessment-repository.test.ts',
      'apps/chess-kids/src/adapters/storage/local-assessment-repository.ts',
      'apps/chess-kids/src/adapters/storage/local-backup-importer.test.ts',
      'apps/chess-kids/src/adapters/storage/local-backup-importer.ts',
      'apps/chess-kids/src/adapters/storage/local-game-record-repository.ts',
      'apps/chess-kids/src/adapters/storage/local-parent-lock-repository.test.ts',
      'apps/chess-kids/src/adapters/storage/local-parent-lock-repository.ts',
      'apps/chess-kids/src/adapters/storage/local-profile-repository.test.ts',
      'apps/chess-kids/src/adapters/storage/local-profile-repository.ts',
      'apps/chess-kids/src/adapters/storage/local-progress-repository.test.ts',
      'apps/chess-kids/src/adapters/storage/local-progress-repository.ts',
      'apps/chess-kids/src/adapters/storage/local-rewards-repository.test.ts',
      'apps/chess-kids/src/adapters/storage/local-rewards-repository.ts',
      'apps/chess-kids/src/adapters/storage/local-settings-repository.test.ts',
      'apps/chess-kids/src/adapters/storage/local-settings-repository.ts',
      'apps/chess-kids/src/adapters/storage/local-store.test.ts',
      'apps/chess-kids/src/adapters/storage/local-store.ts',
      'apps/chess-kids/src/adapters/storage/migrations.test.ts',
      'apps/chess-kids/src/adapters/storage/migrations.ts',
      'apps/chess-kids/src/adapters/storage/storage-keys.ts',
      'apps/chess-kids/src/app-version.d.ts',
      'apps/chess-kids/src/app/nav.test.ts',
      'apps/chess-kids/src/app/routes.ts',
      'apps/chess-kids/src/app/services.ts',
      'apps/chess-kids/src/app/slices/learn.ts',
      'apps/chess-kids/src/app/slices/nav.ts',
      'apps/chess-kids/src/app/slices/profile.ts',
      'apps/chess-kids/src/app/slices/rewards.ts',
      'apps/chess-kids/src/app/slices/time.ts',
      'apps/chess-kids/src/app/slices/today.ts',
      'apps/chess-kids/src/app/store.ts',
      'apps/chess-kids/src/content-text.ts',
      'apps/chess-kids/src/i18n-options.ts',
      'apps/chess-kids/src/i18n.ts',
      'apps/chess-kids/src/i18next.d.ts',
      'apps/chess-kids/src/kinds/ExerciseControls.tsx',
      'apps/chess-kids/src/kinds/ExercisePlay.tsx',
      'apps/chess-kids/src/kinds/kind-ui.ts',
      'apps/chess-kids/src/kinds/panel-body.tsx',
      'apps/chess-kids/src/kinds/session.ts',
      'apps/chess-kids/src/modes/boss-run.tsx',
      'apps/chess-kids/src/modes/mode-ui.ts',
      'apps/chess-kids/src/modes/series/Step.test.tsx',
      'apps/chess-kids/src/modes/series/Step.tsx',
      'apps/chess-kids/src/modes/series/e2e.ts',
      'apps/chess-kids/src/testing/app-test-helpers.ts',
      'apps/chess-kids/src/testing/fake-backup-file-writer.ts',
      'apps/chess-kids/src/testing/fake-narrator.ts',
      'apps/chess-kids/src/testing/fake-password-file-writer.ts',
      'apps/chess-kids/src/testing/memory-storage.ts',
      'apps/chess-kids/src/testing/mock-media-query.ts',
      'apps/chess-kids/src/testing/render-app.tsx',
      'apps/chess-kids/src/testing/render-with-store.tsx',
      'apps/chess-kids/src/testing/setup.ts',
      'apps/chess-kids/src/ui/AppErrorBoundary.tsx',
      'apps/chess-kids/src/ui/AppNotice.tsx',
      'apps/chess-kids/src/ui/AppUpdater.tsx',
      'apps/chess-kids/src/ui/AssessmentScreen.tsx',
      'apps/chess-kids/src/ui/BadgeIcon.tsx',
      'apps/chess-kids/src/ui/Celebration.test.tsx',
      'apps/chess-kids/src/ui/Celebration.tsx',
      'apps/chess-kids/src/ui/DenScreen.test.tsx',
      'apps/chess-kids/src/ui/DenScreen.tsx',
      'apps/chess-kids/src/ui/FirstRunScreen.tsx',
      'apps/chess-kids/src/ui/HomeScreen.test.tsx',
      'apps/chess-kids/src/ui/HomeScreen.tsx',
      'apps/chess-kids/src/ui/InstallBanner.tsx',
      'apps/chess-kids/src/ui/JourneyScreen.test.tsx',
      'apps/chess-kids/src/ui/JourneyScreen.tsx',
      'apps/chess-kids/src/ui/LazyFallback.tsx',
      'apps/chess-kids/src/ui/LessonScreen.test.tsx',
      'apps/chess-kids/src/ui/LessonScreen.tsx',
      'apps/chess-kids/src/ui/MiniGameSessionScreen.tsx',
      'apps/chess-kids/src/ui/NewPlayerScreen.tsx',
      'apps/chess-kids/src/ui/ParentAreaScreen.tsx',
      'apps/chess-kids/src/ui/PasswordScreen.tsx',
      'apps/chess-kids/src/ui/PlacementOfferScreen.tsx',
      'apps/chess-kids/src/ui/PlacementScreen.tsx',
      'apps/chess-kids/src/ui/PracticeRunScreen.tsx',
      'apps/chess-kids/src/ui/PracticeScreen.test.tsx',
      'apps/chess-kids/src/ui/PracticeScreen.tsx',
      'apps/chess-kids/src/ui/ProfilePickerScreen.tsx',
      'apps/chess-kids/src/ui/RankPill.tsx',
      'apps/chess-kids/src/ui/SessionSummaryScreen.tsx',
      'apps/chess-kids/src/ui/StarsPill.tsx',
      'apps/chess-kids/src/ui/StarsRow.tsx',
      'apps/chess-kids/src/ui/StreakPill.tsx',
      'apps/chess-kids/src/ui/TestOutSheet.tsx',
      'apps/chess-kids/src/ui/TimeLimitScreen.tsx',
      'apps/chess-kids/src/ui/TimeTracker.test.tsx',
      'apps/chess-kids/src/ui/TimeTracker.tsx',
      'apps/chess-kids/src/ui/TodaySession.test.tsx',
      'apps/chess-kids/src/ui/WarmUpScreen.tsx',
      'apps/chess-kids/src/ui/art/animal-images.test.ts',
      'apps/chess-kids/src/ui/art/animal-images.ts',
      'apps/chess-kids/src/ui/art/avatar-meta.ts',
      'apps/chess-kids/src/ui/art/avatars.tsx',
      'apps/chess-kids/src/ui/art/characters.tsx',
      'apps/chess-kids/src/ui/assessment-flow.test.tsx',
      'apps/chess-kids/src/ui/ds/AvatarBadge.tsx',
      'apps/chess-kids/src/ui/ds/ConfirmDialog.tsx',
      'apps/chess-kids/src/ui/ds/NarratedBubble.tsx',
      'apps/chess-kids/src/ui/ds/Owl.tsx',
      'apps/chess-kids/src/ui/ds/ReplayButton.tsx',
      'apps/chess-kids/src/ui/ds/Screen.tsx',
      'apps/chess-kids/src/ui/ds/SpeechBubble.tsx',
      'apps/chess-kids/src/ui/ds/icons-lazy.tsx',
      'apps/chess-kids/src/ui/ds/icons.tsx',
      'apps/chess-kids/src/ui/ds/parent-styles-lazy.ts',
      'apps/chess-kids/src/ui/ds/parent.tsx',
      'apps/chess-kids/src/ui/ds/primitives-styles.ts',
      'apps/chess-kids/src/ui/ds/primitives.test.tsx',
      'apps/chess-kids/src/ui/ds/primitives.tsx',
      'apps/chess-kids/src/ui/ds/speakSequence.test.ts',
      'apps/chess-kids/src/ui/ds/speakSequence.ts',
      'apps/chess-kids/src/ui/ds/tap.ts',
      'apps/chess-kids/src/ui/ds/useAsync.ts',
      'apps/chess-kids/src/ui/ds/useNarratedText.test.tsx',
      'apps/chess-kids/src/ui/ds/useNarratedText.ts',
      'apps/chess-kids/src/ui/lesson-character-labels.ts',
      'apps/chess-kids/src/ui/lesson/CharacterCard.tsx',
      'apps/chess-kids/src/ui/lesson/CompleteStep.tsx',
      'apps/chess-kids/src/ui/lesson/DemoStep.tsx',
      'apps/chess-kids/src/ui/lesson/ExerciseStep.test.tsx',
      'apps/chess-kids/src/ui/lesson/ExerciseStep.tsx',
      'apps/chess-kids/src/ui/lesson/GameLayout.tsx',
      'apps/chess-kids/src/ui/lesson/NextButton.tsx',
      'apps/chess-kids/src/ui/lesson/PhaseChip.test.tsx',
      'apps/chess-kids/src/ui/lesson/PhaseChip.tsx',
      'apps/chess-kids/src/ui/lesson/SkipButton.tsx',
      'apps/chess-kids/src/ui/lesson/StepPills.tsx',
      'apps/chess-kids/src/ui/lesson/StoryStep.tsx',
      'apps/chess-kids/src/ui/lesson/button-styles.ts',
      'apps/chess-kids/src/ui/lesson/exercise-text.ts',
      'apps/chess-kids/src/ui/lesson/phase-track.ts',
      'apps/chess-kids/src/ui/parent-area-flow.test.tsx',
      'apps/chess-kids/src/ui/parent/BackupPanel.tsx',
      'apps/chess-kids/src/ui/parent/ChildReport.tsx',
      'apps/chess-kids/src/ui/parent/ChildSettings.tsx',
      'apps/chess-kids/src/ui/parent/PrivacyPolicy.tsx',
      'apps/chess-kids/src/ui/parent/PrivacyScreen.tsx',
      'apps/chess-kids/src/ui/parent/UnlockPanel.tsx',
      'apps/chess-kids/src/ui/parent/countdown.test.ts',
      'apps/chess-kids/src/ui/parent/countdown.ts',
      'apps/chess-kids/src/ui/parent/parent-styles.ts',
      'apps/chess-kids/src/ui/profiles-flow.test.tsx',
      'apps/chess-kids/src/ui/session/ReviewExerciseStep.test.tsx',
      'apps/chess-kids/src/ui/session/ReviewExerciseStep.tsx',
      'apps/chess-kids/src/ui/session/ReviewTaskRunner.tsx',
      'apps/chess-kids/src/ui/time-limit-flow.test.tsx',
      'apps/chess-kids/src/ui/useMediaQuery.ts',
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
          // block below (plain `no-restricted-imports`, same `apps/chess-kids/src/**` files) does not
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
    files: ['apps/chess-kids/**/*.{ts,tsx}'],
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
    files: ['apps/chess-kids/src/**/*.{ts,tsx}'],
    ignores: [
      'apps/chess-kids/src/kinds/e2e-actions.ts',
      'apps/chess-kids/src/kinds/e2e-registry.ts',
      'apps/chess-kids/src/kinds/*/e2e.ts',
      'apps/chess-kids/src/modes/e2e-registry.ts',
      'apps/chess-kids/src/modes/*/e2e.ts',
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
