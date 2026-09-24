# Non-Functional Requirements — Chess for Kids

Related: [architecture.md](architecture.md), [app-structure.md](app-structure.md).

## 1. Offline (required)

| Requirement | Solution |
|---|---|
| Whole app usable with no network (lessons, games, computer, profiles, progress) | v1 has no server calls; everything runs and stores locally |
| Web / PWA | Service worker (vite-plugin-pwa / Workbox) precaches app shell, compiled content, images, fonts, audio of the selected language |
| Fonts | Self-hosted (no Google Fonts at runtime) |
| Narration | Recorded audio precached; Web Speech API only in prototype (some browser voices need network) |
| Capacitor apps | All assets bundled in the app → offline by default |
| Updates | Checked when online; applied at next app start, never mid-session |
| Storage eviction | Request persistent storage; prompt parent to "Add to Home Screen" on iPad (Safari may clear website data after 7 days without use); backup file (§5) |
| Offline size budget | ≤ 50 MB per language (audio ≈ 500 clips × ~30 KB ≈ 15 MB) |

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
| Parent gate | Parent password (≥ 4 characters) before parent area, unlocks, limits, reset, external links; stored hashed on device; 5 wrong attempts → 1-minute wait; recovery via recovery file saved at setup |
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
| Languages | English first; all text by key; audio per language; right-to-left not in scope |
| Security | Content Security Policy; no remote code; content validated at build |
| Telemetry | None in v1; parent report computed on device |
