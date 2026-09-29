/**
 * Chess-defaulted test wiring: the platform's `makeDeps` with chess as the `AppDeps.subject` / `app`.
 */
import { makeDeps as makePlatformDeps } from '@learn/platform-core/testing';
import { createSubjectRuntime } from '@learn/platform-core/domain/runtime';
import type { AppDeps } from '@learn/platform-core/app/use-cases';
import { chessCore, CHESS_APP_CONFIG } from '../core/chess-core.ts';

export {
  makeContentSource,
  stubContent,
  type ContentSourceSeed,
} from '@learn/platform-core/testing';

/** Every required `AppDeps` port, wired to the in-memory fakes, with chess as the subject. */
export function makeDeps(overrides: Partial<AppDeps> = {}): AppDeps {
  return makePlatformDeps({
    subject: createSubjectRuntime(chessCore),
    app: { ...CHESS_APP_CONFIG, version: '0.0.0-test' },
    ...overrides,
  });
}
