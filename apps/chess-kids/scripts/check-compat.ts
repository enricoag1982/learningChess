import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';
import type { Node } from 'acorn';

/**
 * Oldest supported browser: Safari 15.4 (iPad mini 4 on iOS 15.8, owner device; non-functional.md
 * §4). `vite.config.ts` pins `build.target` to it, which lowers syntax it can lower; this check
 * fails the build on what it cannot lower (syntax and regex features) and on Safari 16+ only
 * built-ins called by name. A blank page on iOS 15 (a Safari 16+ only call at startup) is why
 * this exists. Not a full polyfill audit: the e2e "older Safari" test covers startup behaviour.
 */
const distDir = join(dirname(fileURLToPath(import.meta.url)), '../dist');

/** Safari 16+ only built-ins, matched as `.name(` or `Global.name` in the minified output. */
const NEWER_APIS: readonly RegExp[] = [
  /\.(toSorted|toReversed|toSpliced|isWellFormed|toWellFormed|checkVisibility|showPopover)\(/,
  /\.(union|intersection|symmetricDifference|isSubsetOf|isSupersetOf|isDisjointFrom)\(/,
  /\b(Object|Map)\.groupBy\b/,
  /\bPromise\.withResolvers\b/,
  /\bArray\.fromAsync\b/,
  /\bAbortSignal\.(any|timeout)\b/,
  /\bIterator\.from\b/,
  /\bCSS\.registerProperty\b/,
];

interface Finding {
  readonly file: string;
  readonly what: string;
  readonly snippet: string;
}

function jsFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return jsFiles(path);
    return entry.name.endsWith('.js') ? [path] : [];
  });
}

function scan(file: string): Finding[] {
  const source = readFileSync(file, 'utf8');
  const name = file.slice(distDir.length + 1);
  const findings: Finding[] = [];
  const add = (what: string, node: Node): void => {
    findings.push({ file: name, what, snippet: source.slice(node.start, node.start + 60) });
  };

  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
  const walk = (node: unknown): void => {
    if (typeof node !== 'object' || node === null) return;
    const n = node as Node & Record<string, unknown>;
    if (typeof n.type !== 'string') return;
    if (n.type === 'StaticBlock') add('class static block (Safari 16.4)', n);
    if (n.type === 'Literal') {
      const regex = n.regex as { pattern: string; flags: string } | undefined;
      if (regex?.flags.includes('v')) add('regex v flag (Safari 17)', n);
      if (regex && /\(\?<[=!]/.test(regex.pattern)) add('regex lookbehind (Safari 16.4)', n);
    }
    if (
      (n.type === 'ImportDeclaration' || n.type === 'ExportNamedDeclaration') &&
      Array.isArray(n.attributes) &&
      n.attributes.length > 0
    ) {
      add('import attributes (Safari 17.2)', n);
    }
    for (const value of Object.values(n)) {
      if (Array.isArray(value)) value.forEach(walk);
      else walk(value);
    }
  };
  walk(ast);

  for (const pattern of NEWER_APIS) {
    const match = pattern.exec(source);
    if (match) {
      findings.push({
        file: name,
        what: `Safari 16+ API ${match[0]}`,
        snippet: source.slice(Math.max(0, match.index - 30), match.index + 30),
      });
    }
  }
  return findings;
}

const files = jsFiles(distDir);
if (files.length === 0) throw new Error(`no .js files in ${distDir} — run the build first`);

const findings = files.flatMap(scan);
for (const finding of findings) {
  console.error(`${finding.file}: ${finding.what}\n    …${finding.snippet}…`);
}
console.log(
  `compat (Safari 15.4): ${String(files.length)} files, ${String(findings.length)} findings`,
);
if (findings.length > 0) process.exitCode = 1;
