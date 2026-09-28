import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

/** Renders `public/icon.svg` to every PNG the manifest and `index.html` reference. */

const publicDir = join(dirname(fileURLToPath(import.meta.url)), '../public');
const iconSvg = readFileSync(join(publicDir, 'icon.svg'), 'utf8');

// The background rect is icon.svg's first child; everything after it is the pawn + star
// artwork, reused below to build the maskable variant on its own full-bleed background.
const artwork = /<rect[^>]*\/>\s*([\s\S]*)<\/svg>\s*$/.exec(iconSvg)?.[1];
if (artwork === undefined) {
  throw new Error('icon.svg: could not separate the background rect from the artwork');
}

const maskableSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" fill="#FBF6EC" />
  <g transform="translate(50 50) scale(0.8) translate(-50 -50)">
    ${artwork}
  </g>
</svg>`;

interface Target {
  readonly file: string;
  readonly size: number;
  readonly svg: string;
  /** Keep the source's transparent corners (rounded icon) instead of filling them opaque. */
  readonly transparentCorners: boolean;
}

const targets: readonly Target[] = [
  { file: 'pwa-192.png', size: 192, svg: iconSvg, transparentCorners: true },
  { file: 'pwa-512.png', size: 512, svg: iconSvg, transparentCorners: true },
  { file: 'apple-touch-icon.png', size: 180, svg: iconSvg, transparentCorners: true },
  { file: 'maskable-512.png', size: 512, svg: maskableSvg, transparentCorners: false },
];

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH });
try {
  const page = await browser.newPage();
  for (const target of targets) {
    await page.setViewportSize({ width: target.size, height: target.size });
    const sized = target.svg.replace(
      '<svg ',
      `<svg width="${String(target.size)}" height="${String(target.size)}" `,
    );
    await page.setContent(`<!doctype html><html><body style="margin:0">${sized}</body></html>`);
    await page.screenshot({
      path: join(publicDir, target.file),
      omitBackground: target.transparentCorners,
    });
    console.log(`icons: wrote public/${target.file}`);
  }
} finally {
  await browser.close();
}
