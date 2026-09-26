import { Component } from 'react';
import type { ErrorInfo, JSX, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Owl } from './Owl.tsx';
import { TapButton } from './primitives.tsx';

/** What a child (or the parent helping) sees instead of a blank page when the app cannot start or
 * a screen crashes: Owl, a short message, the error text (small, for the parent to
 * report) and "Try again" (reload). Found on an iPad mini 4 (iOS 15): one startup exception left
 * an empty page with nothing to report. */
function AppErrorScreen({ message }: { readonly message: string }): JSX.Element {
  const { t } = useTranslation();
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-cream px-4 text-center">
      <Owl className="h-20 w-20" />
      <h1 className="font-display text-2xl text-ink">{t('app-error.title')}</h1>
      <p className="max-w-md text-base text-ink">{t('app-error.body')}</p>
      <TapButton
        variant="primary"
        role="go"
        className="w-64 flex-none"
        onClick={() => {
          window.location.reload();
        }}
      >
        {t('app-error.retry')}
      </TapButton>
      <p className="max-w-md break-words text-xs text-muted">{message}</p>
    </main>
  );
}

interface AppErrorBoundaryState {
  readonly message: string | null;
}

/** Top-level error boundary (`main.tsx`): any render error — including a failing composition root
 * (`createServices`) or an `init()` rejection that `App` rethrows — shows `AppErrorScreen`. */
export class AppErrorBoundary extends Component<
  { readonly children: ReactNode },
  AppErrorBoundaryState
> {
  override state: AppErrorBoundaryState = { message: null };

  static getDerivedStateFromError(error: unknown): AppErrorBoundaryState {
    return { message: error instanceof Error ? error.message : String(error) };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error(error, info.componentStack);
  }

  override render(): ReactNode {
    return this.state.message === null ? (
      this.props.children
    ) : (
      <AppErrorScreen message={this.state.message} />
    );
  }
}
