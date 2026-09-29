import { defineAppConfig } from '@learn/platform-web/build/app-config.ts';

export default defineAppConfig({
  appUrl: import.meta.url,
  manifest: {
    name: 'Math for Kids (demo)',
    short_name: 'Math demo',
    description: 'Offline maths demo on the learning platform.',
    icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' }],
  },
});
