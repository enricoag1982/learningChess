# Storage compat fixtures (docs/refactor-v4.md R0)

One folder per released tag: `local-storage.json` (every `chess-kids:*` key, raw strings),
`backup-all.json` (parent area "Export all"), `share-mia.json` (v2.0.0+ only, "Send to other
device"). `storage-compat.test.ts`/`.spec.ts` load these against `master`; a fixture that fails to
load cleanly there is a real compat bug, not a fixture problem.

**Add one for a new release**: worktree the tag, `pnpm install --frozen-lockfile && pnpm build`;
copy `generate-fixture.spec.ts` into its `apps/web/e2e/`, set `TAG`, adapt to that release's own
labels/features (never its app code); run it (`PW_CHROMIUM_PATH=... PW_PORT=<free>
pnpm exec playwright test e2e/generate-fixture.spec.ts --project=chromium`); move the written
`test-fixtures/storage/<tag>/` here; remove the scratch worktree.

Per-tag: v1.0.0/v1.1.0 label it "Password", no weekend limit/"Play until"/share (M7.1/M7.2+ only).
No `GameRecord` any tag (full game needs World 4, too costly here) or `session-logs`/`unlocks`.
