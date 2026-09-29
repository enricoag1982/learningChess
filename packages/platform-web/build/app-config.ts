import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import type { Plugin, UserConfig } from 'vite';
import { defineConfig as defineTestConfig } from 'vitest/config';
import type { ViteUserConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import type { ManifestOptions } from 'vite-plugin-pwa';

export type ManifestIcon = NonNullable<ManifestOptions['icons']>[number];

export interface AppBuildOptions {
  /** `import.meta.url` of the app's config file; its sibling `package.json` gives `__APP_VERSION__`. */
  readonly appUrl: string;
  readonly manifest: {
    readonly name: string;
    readonly short_name: string;
    readonly description: string;
    readonly icons?: readonly ManifestIcon[];
  };
}

/** Read from the file rather than imported as JSON, which would pull `devDependencies` into the graph. */
function appVersion(appUrl: string): string {
  const { version } = JSON.parse(
    readFileSync(fileURLToPath(new URL('./package.json', appUrl)), 'utf-8'),
  ) as { version: string };
  return version;
}

// No remote code or third-party network access (non-functional.md §3, §6). `blob:` workers cover
// the dev server's module worker pipeline; `unsafe-inline` styles cover React's `style` prop.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
].join('; ');

/** Build only: the dev server's HMR client is not checked against the policy. */
function cspPlugin(): Plugin {
  return {
    name: 'app-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
      );
    },
  };
}

/** Vite + PWA config shared by every app; `BASE_PATH` sets the GitHub Pages sub-path. */
export function defineAppConfig({ appUrl, manifest }: AppBuildOptions): UserConfig {
  return defineConfig({
    base: process.env.BASE_PATH ?? '/',
    define: { __APP_VERSION__: JSON.stringify(appVersion(appUrl)) },
    // One instance of each stateful library across the linked workspace packages.
    resolve: { dedupe: ['react', 'react-dom', 'zustand', 'i18next', 'react-i18next', 'zod'] },
    build: {
      // Oldest supported: Safari 15.4 (iPad mini 4, iOS 15.8); `pnpm compat` checks the result.
      target: ['es2022', 'safari15.4', 'chrome100', 'edge100', 'firefox100'],
      // Art webp files stay real, precached files; inlining them would bloat the initial JS.
      assetsInlineLimit: (filePath) => (filePath.endsWith('.webp') ? false : undefined),
    },
    plugins: [
      react(),
      tailwindcss(),
      cspPlugin(),
      VitePWA({
        registerType: 'prompt',
        // The app registers the worker itself, so it decides when a waiting update reloads.
        injectRegister: false,
        includeAssets: ['icon.svg', 'apple-touch-icon.png'],
        manifest: {
          name: manifest.name,
          short_name: manifest.short_name,
          description: manifest.description,
          lang: 'en',
          start_url: '.',
          scope: '.',
          display: 'standalone',
          orientation: 'any',
          background_color: '#FBF6EC',
          theme_color: '#2E7D5B',
          ...(manifest.icons ? { icons: [...manifest.icons] } : {}),
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,woff2,json,webp,mp3}'],
          // Latin and latin-ext cover every shown text (accented nicknames); other subsets stay unfetched.
          globIgnores: ['**/*-hebrew-*.woff2', '**/*-cyrillic-*.woff2', '**/*-vietnamese-*.woff2'],
        },
      }),
    ],
  });
}

/** Test config without the PWA plugin (slow, and no role in tests). */
export function defineAppTestConfig({ appUrl }: Pick<AppBuildOptions, 'appUrl'>): ViteUserConfig {
  return defineTestConfig({
    define: { __APP_VERSION__: JSON.stringify(appVersion(appUrl)) },
    plugins: [react()],
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/testing/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
      // No-op guard: a `*.slow.test` file never lands in the default run.
      exclude: ['**/node_modules/**', 'src/**/*.slow.test.{ts,tsx}'],
      // Full-app flows take 3-5 s under parallel load; the 5 s default timed them out.
      testTimeout: 15_000,
    },
  });
}
