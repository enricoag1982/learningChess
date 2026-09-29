import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildContent, exitOnContentError } from '@learn/platform-content/build';
import { mathContent } from '../src/content/math-content.ts';

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));

await buildContent({
  subject: mathContent,
  root: join(packageDir, 'content'),
  out: join(packageDir, 'dist'),
}).catch(exitOnContentError);
