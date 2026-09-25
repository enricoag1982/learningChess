import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// Shown in the parent area (M5.5, `docs/release.md`); read once at build/dev-server start, not
// imported as JSON (that would pull the whole file, incl. `devDependencies`, into the dep graph).
const { version } = JSON.parse(
  readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf-8'),
) as { version: string };

/**
 * Content Security Policy (`non-functional.md` §6 "Security", M5.4 decision table): no remote
 * code, no third-party network access at all (non-functional.md §3 "No tracking" already promises
 * this — this is the browser-enforced version of the same promise). `worker-src 'self' blob:` —
 * the bot worker (`adapters/bot/worker-bot-player.ts`) loads as a same-origin module URL in the
 * production build, but the dev server's own module worker pipeline needs `blob:` too.
 * `style-src 'unsafe-inline'` *is* needed here (checked against the "prefer none" option the
 * decision table gives): Tailwind v4 itself compiles to one static stylesheet, but this codebase's
 * own components set React's `style` prop throughout for values only known at render time (avatar
 * / board colours, computed sizes — `HomeScreen.tsx`, `board/Board.tsx`, `InstallBanner.tsx`, …),
 * which renders as the DOM `style` attribute — CSP's `style-src` (with no separate
 * `style-src-attr`) governs that inline attribute exactly like a `<style>` tag, so `'self'` alone
 * would silently break every one of those. No `unsafe-inline` on `script-src`: nothing here needs
 * an inline `<script>` or an inline event-handler attribute (React attaches listeners in JS, never
 * as `onclick="…"`).
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
].join('; ');

/** Only the production build gets the CSP meta tag: the dev server's own HMR client (a `ws://`
 * connection, module scripts fetched from `/@vite/…` paths) has not been checked against it, and a
 * meta-tag CSP applies to that same `index.html` either way — nothing here narrows it to `build`
 * on its own. Kept to `pnpm build`/`pnpm preview` (what `test:e2e` actually runs against —
 * `playwright.config.ts`'s `webServer`) rather than risk breaking `pnpm dev` for whoever is
 * working on the app at the same time. */
function cspPlugin(): Plugin {
  return {
    name: 'chess-kids-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
      );
    },
  };
}

// Deploy workflow sets BASE_PATH to `/<repo>/` for GitHub Pages; local dev/build default to `/`.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  // Oldest supported: Safari 15.4 (iPad mini 4 on iOS 15.8, owner device; non-functional.md §4).
  // Vite's default target (Safari 16.4+) would let newer syntax through; `pnpm compat` checks the
  // result for what cannot be lowered.
  build: { target: ['es2022', 'safari15.4', 'chrome100', 'edge100', 'firefox100'] },
  // Compile-time string replacement (not `import.meta.env`): fine under the M5.4 CSP's
  // `script-src 'self'` (no `unsafe-inline`/`eval`) since nothing is evaluated at runtime.
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [
    react(),
    tailwindcss(),
    cspPlugin(),
    VitePWA({
      registerType: 'prompt',
      // The app registers itself (`main.tsx`, `adapters/app-update.ts`, `virtual:pwa-register`)
      // instead of the plugin's own injected script, so it controls exactly when a waiting update
      // reloads the page (`docs/non-functional.md` §1 "App update").
      injectRegister: false,
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Chess for Kids',
        short_name: 'Chess Kids',
        description: 'Offline chess lessons and games for young beginners.',
        lang: 'en',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'any',
        background_color: '#FBF6EC',
        theme_color: '#2E7D5B',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,json}'],
      },
    }),
  ],
});
