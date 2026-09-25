import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Owl } from './Owl.tsx';

/**
 * `Suspense` fallback for a lazy-loaded screen (`App.tsx`, `non-functional.md` §4 "Lazy loading"):
 * a small spinning ring around the Owl avatar. Shown only for the moment that screen's own chunk
 * is still downloading — near-instant on a repeat visit, since the service worker precaches every
 * chunk right after first load (`non-functional.md` §1). `role="status"` + the translated label
 * announce it to screen readers the same way any other loading state would; the ring itself is
 * `aria-hidden` (decorative). `.lazy-spin` (`index.css`) is a plain CSS animation, zeroed globally
 * under reduced motion — same pattern every other animation in this codebase already uses.
 */
export function LazyFallback(): JSX.Element {
  const { t } = useTranslation();
  return (
    <main className="flex min-h-screen items-center justify-center bg-cream">
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
