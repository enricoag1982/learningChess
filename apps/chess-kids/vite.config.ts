import { defineAppConfig } from '@learn/platform-web/build/app-config.ts';

export default defineAppConfig({
  appUrl: import.meta.url,
  manifest: {
    name: 'Chess for Kids',
    short_name: 'Chess Kids',
    description: 'Offline chess lessons and games for young beginners.',
    icons: [
      { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
      { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
      { src: 'maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
});
