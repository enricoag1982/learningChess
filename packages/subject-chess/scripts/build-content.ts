import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildContent, exitOnContentError } from '@learn/platform-content/build';
import { chessContent } from '../src/content/chess-content.ts';

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));

await buildContent({
  subject: chessContent,
  root: join(packageDir, 'content'),
  out: join(packageDir, 'dist'),
}).catch(exitOnContentError);
