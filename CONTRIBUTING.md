# Contributing

## Workflow

| Rule | Detail |
|---|---|
| `master` | Always releasable; changes only via pull request |
| Branches | From `master`: `m<N>-<topic>` for milestones (e.g. `m0-scaffold`), `feat/…`, `fix/…`, `chore/…`, `docs/…` |
| Pull requests | Small, one topic; description follows the PR template |
| Quality gate | Required check `quality` (CI) must be green; branch up to date with `master` |
| Approvals | 0 required for now (single developer); review can happen after merge |
| Merge | Squash merge only; PR title = commit message; branch deleted after merge |
| History | Linear; no force push or deletion of `master` |
| Decisions | Recorded in `docs/` in the same PR |
| Tags | Each merged iteration: annotated tag `m<N>.<i>` (milestone done: also `m<N>`), created by `.github/workflows/tag.yml` from the squash title `M<N>.<i>: …`; message = the tag's row in [docs/validation.md](docs/validation.md) (checks run). Backfill: run the workflow manually with `tag` + `ref` |

## Quality gate (`quality` job, `.github/workflows/ci.yml`)

Format check → lint → typecheck → unit + content tests → build → E2E smoke test (Playwright). New checks are added as steps of the same job, so the required check name never changes.

## Repository settings (manual, GitHub UI)

**Settings → Rules → Rulesets → New branch ruleset**

| Setting | Value |
|---|---|
| Name / enforcement | `master-quality` / Active |
| Target branches | Default branch (`master`) |
| Bypass list | Empty |
| Restrict deletions | On |
| Require linear history | On |
| Require a pull request before merging | On · required approvals **0** · require conversation resolution · allowed merge method: Squash |
| Require status checks to pass | On · check `quality` · require branches to be up to date |
| Block force pushes | On |

**Settings → General**

| Setting | Value |
|---|---|
| Default branch | `master` |
| Pull requests | Allow squash merging only (default commit message: PR title) · Always suggest updating PR branches · Automatically delete head branches |

**Settings → Pages** (at M0): Source = GitHub Actions.
