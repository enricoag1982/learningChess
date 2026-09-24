import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

/** M0 shell: one calm welcome screen. Lessons, board and games arrive in later milestones. */
export default function App() {
  const { t } = useTranslation();
  const [offlineReady, setOfflineReady] = useState(false);

  useEffect(() => {
    // jsdom (unit tests) and some browsers have no `serviceWorker`; skip the status line there.
    if (!('serviceWorker' in navigator)) return;

    let cancelled = false;
    void navigator.serviceWorker.ready.then(() => {
      if (!cancelled) setOfflineReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 py-12 text-center">
      <h1 className="font-display text-5xl text-ink sm:text-6xl">{t('app.title')}</h1>
      <p className="max-w-md text-2xl">{t('home.greeting')}</p>
      <p className="max-w-md text-xl text-muted">{t('home.coming-soon')}</p>
      {offlineReady && (
        <p className="flex items-center gap-2 text-lg text-go">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {t('offline.ready')}
        </p>
      )}
    </main>
  );
}
