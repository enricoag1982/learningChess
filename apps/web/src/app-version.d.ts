// `vite.config.ts`'s `define` inlines this at build time from `package.json`'s own `version`
// (M5.5, `docs/release.md`): a compile-time string replacement, not `import.meta.env`, so it needs
// no `script-src 'unsafe-inline'`/`eval` and is unaffected by the M5.4 CSP.
declare const __APP_VERSION__: string;
