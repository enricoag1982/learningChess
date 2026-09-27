# Non-Functional Requirements — Chess for Kids

Related: [architecture.md](architecture.md), [app-structure.md](app-structure.md).

## 1. Offline (required)

| Requirement | Solution |
|---|---|
| Whole app usable with no network (lessons, games, computer, profiles, progress) | v1 has no server calls; everything runs and stores locally |
| Web / PWA | Service worker (vite-plugin-pwa / Workbox) precaches app shell, compiled content, images, fonts |
| Fonts | Self-hosted (no Google Fonts at runtime) |
| Narration | Generated audio files, precached; Web Speech API with on-device voices only (`localService`) as fallback; subtitles always shown, so the app works without voice |
| Capacitor apps | All assets bundled in the app → offline by default |
| Updates | No periodic polling (owner decision); checked on load and on return to the app. Applied only at a safe screen (Home / profile picker) — never mid-lesson/game/assessment/time-limit/parent; an update found elsewhere just waits until the kid next lands on one of those (§1.2) |
| Storage eviction | Request persistent storage; prompt parent to "Add to Home Screen" on iPad (Safari may clear website data after 7 days without use); backup file (§5) |
| Offline size budget | ≤ 50 MB per language (incl. audio) |

### 1.1 Implementation

| Topic | Implementation |
|---|---|
| Persistent storage | `requestPersistentStorageIfNeeded` (`adapters/persistent-storage.ts`), called from profile creation: feature-detects `navigator.storage.persist()`, asks at most once ever per device (own localStorage flag); result also written to `AppSettings.storagePersisted` for the parent area |
| iPad install banner | `ui/InstallBanner.tsx`, shown on Home only: iOS Safari, not already standalone; dismiss remembered (own localStorage flag) |
| Lazy loading | `React.lazy` + `Suspense` for `ParentAreaScreen`/`FriendSetupScreen`/`FriendGameScreen`/`PlacementOfferScreen`/`PlacementScreen`/`AssessmentScreen`, each its own chunk fetched on first use; `check-size.ts` measures the *initial* chunk (entry script + `modulepreload` links) against the 300 KB budget and reports the grand total (incl. lazy chunks + bot worker) alongside it |
| Precache | `vite.config.ts`'s `workbox.globPatterns` globs the whole `dist` output, so every chunk (lazy or not) is precached |
| Cold start | `e2e/performance.spec.ts`: 4× CPU throttle + tablet viewport, timed from a warm-cache reload through picker → Home interactive; asserted `< 5 s` in CI |
| CSP | `cspPlugin` (build only) injects `<meta http-equiv="Content-Security-Policy">`: `default-src 'self'; script-src 'self'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'` — `style-src` needs `'unsafe-inline'` for React's own `style` prop; no `unsafe-inline` on `script-src`. `performance.spec.ts` asserts no `securitypolicyviolation` fires |

### 1.2 App update

| Topic | Implementation |
|---|---|
| Registration | `vite-plugin-pwa`: `registerType: 'prompt'`, `injectRegister: false`; the app registers itself via `virtual:pwa-register`'s `registerSW`, imported only in `main.tsx` |
| Adapter | `adapters/app-update.ts`'s `createAppUpdate(register)`: tracks `isUpdateReady()` (`onNeedRefresh` fired) and `apply()` (`updateSW(true)` — skip-waiting + reload, idempotent) |
| Check | No periodic polling (owner decision); checked on load (service-worker registration) and on return to the app (`registration.update()` on `visibilitychange` → visible) |
| Apply | `ui/AppUpdater.tsx` (renders nothing): on every screen change, applies a ready update only if the new screen is `'home'` or `'picker'` — an update found elsewhere waits until the kid next lands on one of those |
| Offline | Precache still covers the whole `dist` output; offline e2e green |

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
| Parent gate | Parent code (≥ 4 characters) before parent area, unlocks, limits, reset, external links; kept in a simple plain-text file (kid-gate, not a security boundary); password screen shows the file location; 5 wrong attempts → 1-minute wait |
| Parent control | Export and delete each profile's data |
| App stores | Privacy policy; complies with Apple Kids category and Google Play Families (no third-party analytics / ads, parental gate) |
| Regulations | No personal data leaves the device → minimal COPPA / GDPR (Art. 8) obligations in v1; v2 stays offline; a later online login would need a parental consent flow |

## 4. Performance

| Metric | Target |
|---|---|
| Cold start | ≤ 3 s on reference devices |
| Tap response | ≤ 100 ms |
| Animations | 60 fps |
| Computer move | ≤ 300 ms compute (worker) |
| Initial JS | ≤ 300 KB gzipped; parent area and later worlds lazy-loaded |

Reference devices: iPad (9th gen, 2021), mid-range Android tablet (e.g. Samsung Galaxy Tab A8), desktop browsers, **iPad mini 4 on iOS 15.8 (owner device, oldest supported)**. Browsers: latest 2 versions of Safari, Chrome, Edge, Firefox; **minimum Safari 15.4 (iOS / iPadOS 15.4)**.

| Older-browser rule (v1.1.1, owner found a blank page on iPad mini 4) | How |
|---|---|
| Build target | `vite.config.ts` `build.target` = `es2022`, `safari15.4`, `chrome100`, `edge100`, `firefox100` (Vite's default is Safari 16.4+) |
| Compat check | `pnpm compat` (CI, after the size budget): scans the built JS for syntax / regex features Safari 15.4 lacks and Safari 16+ only built-ins called by name |
| Guard newer APIs | Feature-check before use; e.g. `speechSynthesis.addEventListener` does not exist before Safari 16 (not an `EventTarget`) — its call at startup was the blank page |
| Never blank | `AppErrorBoundary` (`main.tsx`): any startup / render error shows Owl + "Try again" + the error text; a browser that cannot run the app at all shows a static "needs iOS 15.4 or newer" note after 8 s (`index.html`) |
| Test | `e2e/older-safari.spec.ts`: starts with Safari 15's `SpeechSynthesis`; a startup failure shows the error screen |
| Heights | `dvh`, never `vh`/`min-h-screen`: iOS Safari `vh` = toolbar-hidden height → page taller than the visible area (owner report, iPad mini 4, iOS 15.8, 2026-09-26). Game boards: measured to fit the space the panel leaves (`GameLayout`), no viewport-% cap. Fit test `e2e/fit.spec.ts` at Safari's visible area: 768×900, 1024×660, phone 390×844 |

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
