import { fileURLToPath } from 'node:url';

/** Platform locale YAML root (`<root>/<lang>/<namespace>.yaml`), merged with a subject's own. */
export const PLATFORM_LOCALES_DIR = fileURLToPath(new URL('../locales', import.meta.url));
