# Non-Functional Requirements — Chess for Kids

Related: [architecture.md](architecture.md), [app-structure.md](app-structure.md).

## 1. Offline (required)

| Requirement | Solution |
|---|---|
| Whole app usable with no network (lessons, games, computer, profiles, progress) | v1 has no server calls; everything runs and stores locally |
| Web / PWA | Service worker (vite-plugin-pwa / Workbox) precaches app shell, compiled content, images, fonts |
| Fonts | Self-hosted (no Google Fonts at runtime) |
| Narration | Web Speech API with on-device voices only (`localService`; some browser voices need network); subtitles always shown, so the app works without voice. M6: generated audio files, precached |
| Capacitor apps | All assets bundled in the app → offline by default |
| Updates | No periodic polling (owner decision); checked on load and on return to the app. Applied only at a safe screen (Home / profile picker) — never mid-lesson/game/assessment/time-limit/parent; an update found elsewhere just waits until the kid next lands on one of those (v1.1.0, §1.2) |
| Storage eviction | Request persistent storage; prompt parent to "Add to Home Screen" on iPad (Safari may clear website data after 7 days without use); backup file (§5) |
| Offline size budget | ≤ 20 MB in v1 (no audio files); ≤ 50 MB per language with audio (M6) |

### 1.1 Implementation (M5.4)

| Topic | Implementation |
|---|---|
| Persistent storage | `apps/web/src/adapters/persistent-storage.ts`'s `requestPersistentStorageIfNeeded`: called from `store.ts`'s `finishNewPlayer` on the profile-creation flow, feature-detects `navigator.storage.persist()` and asks at most once ever per device (its own `chess-kids:storage-persist-requested` localStorage flag, not `AppSettings` itself — see that field's own doc comment in `packages/core/src/app/ports.ts` for why). The result is also written to `AppSettings.storagePersisted` for the parent area to read (M5.1); `local-settings-repository.ts`'s own `normalize`/`isAppSettingsShape` whitelist needs a matching update to round-trip it through a later `get()` (M5.1's file, out of this milestone's scope) |
| iPad install banner | `apps/web/src/adapters/install-banner.ts` (pure UA/standalone matrix, unit-tested) + `ui/InstallBanner.tsx`, shown on Home only: iOS Safari (excludes Chrome/Firefox for iOS — different "Add to Home Screen" flow), not already standalone (`navigator.standalone` / `display-mode: standalone`); dismiss remembered via its own `chess-kids:install-banner-dismissed` localStorage flag |
| Lazy loading | `App.tsx`: `React.lazy` + `Suspense` (fallback `ui/LazyFallback.tsx`, a small spinning Owl) for `ParentAreaScreen`, `FriendSetupScreen`, `FriendGameScreen`, `PlacementOfferScreen`, `PlacementScreen`, `AssessmentScreen` — each its own chunk, fetched only when that screen first shows. Dev playgrounds (`/#board` etc.) were already excluded from the production bundle via `main.tsx`'s own conditional dynamic `import()`, unchanged. `apps/web/scripts/check-size.ts` now measures the *initial* chunk only (`dist/index.html`'s `<script type="module">` + every `<link rel="modulepreload">`, i.e. exactly what a first cold load fetches) against the 300 KB budget, and reports the grand total (every built JS file, incl. lazy chunks + the bot worker) alongside it — measured (this machine): initial 179.2 KB gzip before → 174.4 KB gzip after (the lazy screens' own code no longer modulepreloaded eagerly; their shared `characters.tsx` art module stays eager, since Home/Lesson/Journey also import it, so the win is real but modest); total 195.8 KB → 200.8 KB gzip (a few KB of extra Bear search code + per-chunk overhead) |
| Precache | Already satisfied unchanged: `vite.config.ts`'s `workbox.globPatterns` globs the whole `dist` output, so every chunk (lazy or not) is precached regardless — confirmed by the precache entry count rising from 24 to 36 once the lazy screens split into their own files |
| Cold start | `apps/web/e2e/performance.spec.ts`: Chromium DevTools `Emulation.setCPUThrottlingRate` (4×) + tablet viewport, timed from a warm-cache reload through picker → Home interactive; asserted `< 5 s` in CI (flake margin), local number logged in `docs/validation.md` |
| CSP | `apps/web/vite.config.ts`'s `cspPlugin` (`apply: 'build'` only — never `pnpm dev`, so the Vite HMR client is unaffected) injects `<meta http-equiv="Content-Security-Policy">` into `dist/index.html`: `default-src 'self'; script-src 'self'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'` — `style-src` needs `'unsafe-inline'` (React's own `style` prop, used throughout for render-time colours/sizes, renders as the DOM `style` attribute, which `style-src` governs the same as a `<style>` tag); no `unsafe-inline` on `script-src`. `performance.spec.ts` listens for `securitypolicyviolation` across Home/Journey/Play/Den/parent area and asserts none fire |

### 1.2 App update (v1.1.0)

Owner found: phone showed a 7-hour-old build — `registerType: 'prompt'` alone (M5.4's own choice) had no update UI at all, so a waiting version sat until every tab closed.

| Topic | Implementation |
|---|---|
| Registration | `vite-plugin-pwa`: `registerType: 'prompt'` kept, `injectRegister: false` (`vite.config.ts`) — the plugin injects nothing; the app registers itself via `virtual:pwa-register`'s `registerSW`, imported only in `main.tsx` (the composition root) so `App.tsx`/`App.test.tsx` never touch a module unavailable outside a Vite/PWA build |
| Adapter | `apps/web/src/adapters/app-update.ts`'s `createAppUpdate(register)`: takes an injectable `RegisterSW` (unit-testable without the real plugin); tracks `isUpdateReady()` (`onNeedRefresh` fired) and `apply()` (`updateSW(true)` — skip-waiting + reload, idempotent) |
| Check | No periodic polling (owner decision, dropped mid-task from the original spec's "every 60 min"); checked on load (the browser's own check on service-worker registration) and on return to the app (`onRegisteredSW`'s `registration.update()`, called whenever `document.visibilityState` becomes `'visible'` — a tablet waking from sleep, not only a fresh load) |
| Apply | `ui/AppUpdater.tsx` (renders nothing, mounted in `App.tsx` alongside `TimeTracker`/`Celebration`): on every screen change, applies a ready update only if the new screen is `'home'` or `'picker'` — an update found elsewhere just waits (`isUpdateReady()` stays true) until the kid next lands on one of those |
| Offline | Unchanged — precache still covers the whole `dist` output (`vite.config.ts`'s `workbox.globPatterns`); offline e2e green |

## 2. Accessibility

| Area | Requirement |
|---|---|
| Non-readers | Every text spoken; replay button; icons on every action |
| Touch | Targets ≥ 64 px (kid), ≥ 44 px (parent); tap-tap and drag both supported |
| Colour | Never the only signal (lock icons, check marks, dots / rings); text contrast ≥ 4.5:1 |
| Motion / sound | Respect "reduce motion"; sound and voice toggles; subtitles always on |
| Screen readers | All controls labelled; board squares announced ("e4, white bishop"); parent area WCAG 2.2 AA |

## 3. Privacy and child safety

| Requirement | Solution |
|---|---|
| Minimal data | Nickname + avatar only; no photos, email, location |
| No tracking | No analytics, ads or third-party SDKs; no network requests except app updates |
| Parent gate | Parent password (≥ 4 characters) before parent area, unlocks, limits, reset, external links; kept in a simple plain-text file (kid-gate, not a security boundary); password screen shows the file location; 5 wrong attempts → 1-minute wait |
| Parent control | Export and delete each profile's data |
| App stores | Privacy policy; complies with Apple Kids category and Google Play Families (no third-party analytics / ads, parental gate) |
| Regulations | No personal data leaves the device → minimal COPPA / GDPR (Art. 8) obligations in v1; login in v2 requires parental consent flow |

## 4. Performance

| Metric | Target |
|---|---|
| Cold start | ≤ 3 s on reference devices |
| Tap response | ≤ 100 ms |
| Animations | 60 fps |
| Computer move | ≤ 300 ms compute (worker) |
| Initial JS | ≤ 300 KB gzipped; parent area and later worlds lazy-loaded |

Reference devices: iPad (9th gen, 2021), mid-range Android tablet (e.g. Samsung Galaxy Tab A8), desktop browsers. Browsers: latest 2 versions of Safari, Chrome, Edge, Firefox.

## 5. Reliability and data

| Requirement | Solution |
|---|---|
| No lost progress | Autosave after every exercise and every move |
| Resume | Unfinished lesson or game resumes after app close |
| Data upgrades | Versioned storage schema + tested migrations |
| Backup (local-only data) | Parent area: export / import progress file (JSON) |

## 6. Other

| Area | Requirement |
|---|---|
| Languages | English first; all text by key; device voice per language (v3: audio per language); right-to-left not in scope |
| Security | Content Security Policy; no remote code; content validated at build |
| Telemetry | None in v1; parent report computed on device |
