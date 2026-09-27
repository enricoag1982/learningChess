import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Owl } from './ds/Owl.tsx';

/** `Suspense` fallback for a lazy-loaded screen: a spinning ring around the Owl avatar, shown only
 * while that chunk downloads. `role="status"` for a11y; `.lazy-spin` zeroes under reduced motion. */
export function LazyFallback(): JSX.Element {
  const { t } = useTranslation();
  return (
    <main className="flex min-h-dvh items-center justify-center bg-cream">
      <div
        role="status"
        aria-label={t('loading')}
        className="relative flex h-24 w-24 items-center justify-center"
      >
        <div
          aria-hidden="true"
          className="lazy-spin absolute inset-0 rounded-full border-4 border-line border-t-go"
        />
        <Owl className="h-16 w-16" />
      </div>
    </main>
  );
}
