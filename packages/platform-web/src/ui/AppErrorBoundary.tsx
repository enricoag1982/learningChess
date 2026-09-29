import { Component } from 'react';
import type { ErrorInfo, JSX, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Owl } from './ds/Owl.tsx';
import { TapButton } from './ds/primitives.tsx';

/** Shown instead of a blank page when the app cannot start or a screen crashes: Owl, a short message, the error text, "Try again". */
function AppErrorScreen({ message }: { readonly message: string }): JSX.Element {
  const { t } = useTranslation();
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-cream px-4 text-center">
      <Owl className="h-20 w-20" />
      <h1 className="font-display text-2xl text-ink">{t('app-error.title')}</h1>
      <p className="max-w-md text-base text-ink">{t('app-error.body')}</p>
      <TapButton
        look="primary"
        tone="go"
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

/** Top-level boundary (`mountApp`): any render error, incl. a failing `createServices` or an `init()` rejection `App` rethrows. */
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
