# Release Checklist — Chess for Kids

Related: [validation.md](validation.md), [roadmap.md](roadmap.md), [../CONTRIBUTING.md](../CONTRIBUTING.md).

## 1. Pre-release checks (before merging the release PR)

| Check | How |
|---|---|
| CI green | `quality` check passes on the PR head (branch up to date with `master`) |
| Version bump | `apps/web/package.json` `version` set to the release version (`1.0.0` for MVP); shown in the parent area (`__APP_VERSION__`, injected at build by `vite.config.ts`'s `define` — see `docs/architecture.md` §11) |
| Validation log row | `docs/validation.md` has a row for this iteration's tag (checks run, notes) — the tag workflow refuses to create a tag without one |
| Privacy page | Parent area → Privacy renders; link from the first-run parent password screen opens it; `docs/privacy-policy.md` matches the in-app text |
| Offline test | Built app (`pnpm build && pnpm preview`), airplane mode / devtools offline, on an iPad and an Android tablet: reload works, a lesson plays, computer opponent still moves |
| Cold start | `apps/web/e2e/performance.spec.ts`'s timing (CPU-throttled, tablet) — logged in `docs/validation.md`, target < 3 s local / < 5 s CI |
| Data backup / restore | Parent area → Backup: export a profile, import it back (or on a second device), progress matches |
| Manual smoke | One full lesson + one mini-game + one full game vs computer, on a real tablet if available |

## 2. Tagging `v1.0.0`

Every merged iteration already gets an annotated tag from `.github/workflows/tag.yml` (`CONTRIBUTING.md`): the last M5 iteration's squash title (`M5.3: …`, run order in `roadmap.md` §3.1) tags `m5.3`, and — with an `m5` row in the same commit — also `m5` (the milestone tag, MVP done). `v1.0.0` is an additional tag on that same commit, for the release itself:

1. Merge the last M5 PR (squash title `M5.3: …`). CI creates `m5.3` and `m5` on the merge commit.
2. Note the merge commit's full SHA (`git log master` or the merge PR page).
3. `docs/validation.md` must already have a `v1.0.0` row (added in the release PR, pointing at the same commit as `m5`) — the tag workflow requires a row for whatever tag it creates, even on a manual run.
4. GitHub UI → Actions → **Tag** → Run workflow → `tag: v1.0.0`, `ref: <merge commit SHA>` → Run. (A Claude session cannot push tags directly — HTTP 403 — so this step is always a manual workflow run, by the owner or a session with that permission.)
5. Confirm the `v1.0.0` tag exists and points at the same commit as `m5`.

## 3. Rollback

`deploy.yml` builds and publishes whatever ref it runs from (push to `master`, or a manual run). To roll back to a previous release:

1. GitHub UI → Actions → **Deploy** → Run workflow → pick the previous tag (e.g. `m5.4`, or an earlier `vX.Y.Z`) as "Use workflow from" → Run.
2. This builds and deploys that tag's code to GitHub Pages, overwriting the live site — no code change or PR needed.
3. `master` itself is untouched; the next ordinary push to `master` (e.g. the next merged PR) redeploys the current version again, so a rollback is temporary unless `master` itself is reverted.

## 4. Post-release

- Announce / note the release (owner's own channel — out of scope for this repo's automation).
- `docs/roadmap.md` §5: playtest 4 pending (user).
- Next work resumes on a new branch from `master` (`docs/roadmap.md` §4, "After MVP").
