import { mkdir } from 'node:fs/promises';

await mkdir(new URL('../dist/locales/', import.meta.url), { recursive: true });
console.log('content: nothing to build yet');
