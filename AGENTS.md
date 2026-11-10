# AGENTS.md

Guide for any coding agent or contributor (Claude Code, Codex, Cursor, a human) working in this repo.
The full code tour (layout, conventions, external-API table, pitfalls) is in **[`CLAUDE.md`](CLAUDE.md)** — read it before changing code. This file is the short operational part: how to run things, what is allowed, how work is handed over.

## Quick start

No build step, no dependencies for the checks (Node 18+).

```bash
node scripts/unit-test.js          # pure logic in src/lib, instant, no network
node scripts/check-manifest.js     # manifest file refs + every i18n key used in src/ exists
node scripts/gen-locales.js        # regenerate _locales/*/messages.json (then `git diff _locales/` must be what you intended)
node scripts/smoke-test.js         # live, read-only requests to public Steam endpoints (network)
node scripts/package.js            # builds dist/steam-enhancer-vX.Y.Z.zip (dist/ is git-ignored)
```

CI (`.github/workflows/ci.yml`) runs the first three on every PR. All must pass before merge.
Load the extension: `chrome://extensions` → Developer mode → Load unpacked → repo root.
Signed-in checks (`scripts/signed-in-check.js`) need playwright-core and a human who signs in; agents never handle Steam credentials.

## Rules that are easy to break

- **No build step, no ES modules in content scripts.** Files attach to `window.SteamEnhancer` (`SE`).
- **Network only through the service worker** (`SE.bg`). Page globals only through `SE.pageCall` + a named op in `src/content/page-bridge.js`.
- **i18n:** never hardcode UI text. Add keys to the table in `scripts/gen-locales.js`, run it, commit the generated `_locales/`. Never hand-edit `_locales/*/messages.json`.
- **Settings defaults live only in `src/lib/storage.js`.** Options UI comes from `SECTIONS` in `src/options/options.js` (+ an `opt_<key>` label).
- **Never insert into Steam's React trees** (wishlist, new inventory pane, library, Market Beta). Float or sit beside; report with `SE.health.miss(...)`.
- **Money:** wallet currency via `SE.walletCurrency()`; refuse to list when unknown; `sellitem` takes the after-fee amount (`SE.marketFees`).
- **Big API answers are reduced in the service worker before caching** (`chrome.storage.local` is 10 MB).
- **Don't widen `host_permissions`**, don't ship API keys, don't copy code or assets from Augmented Steam / Steam Inventory Helper, keep the "unofficial" disclaimer in docs.
- If you add a pure helper to `src/lib/`, add a case to `scripts/unit-test.js`. If you add an endpoint, add a row to the table in `CLAUDE.md` and a check to `scripts/smoke-test.js` when it can be verified anonymously.

## This repo is public

Everything tracked is world-readable. Never commit local paths (`C:\Users\…`), emails, tokens/keys, personal notes or session transcripts. Private context goes in `*.local.md` files (git-ignored; `HANDOFF.local.md` is the convention). Check `git diff --cached --stat` before every commit.

## Git and release workflow

- Work on a branch (`feat/…`, `fix/…`, `docs/…`, `release/X.Y.Z`); `main` changes only through a PR.
- Don't push, merge, tag, publish a GitHub release or delete branches unless the maintainer asked for exactly that.
- Commit messages: short imperative subject, body says *why*. One concern per PR; update `CHANGELOG.md` under `[Unreleased]`.
- Release (maintainer-driven): bump `version` in `manifest.json` only → CHANGELOG section → `node scripts/package.js` → merge PR → tag `vX.Y.Z` → GitHub release with the ZIP → Chrome Web Store upload (human step). Store texts live in `store-assets/` (EN + `listing/{he,de,ru,pt_BR}.md`).

## Where things stand

- [`ROADMAP.md`](ROADMAP.md): shipped / next / ideas / deliberately set aside (read "set aside" before proposing a feature).
- [`docs/`](docs): per-release plans and test checklists (`PLAN-*.md`, `TESTING-*.md`).
- [`CHANGELOG.md`](CHANGELOG.md): what each version contains.
- Known limits and what has *not* been verified signed in are listed in the release PR description and in the plan's status table.

## Handing work to the next agent

Before ending a session that leaves work half done, leave the repo in a state a stranger can pick up:

1. Commit (or clearly list) what is uncommitted; never leave the checks red without saying so.
2. Update the status table in the current `docs/PLAN-*.md` (done / not done / unverified).
3. Write the open items and the exact next command in the PR description or in `HANDOFF.local.md` (local only).
4. Say what you verified live vs. only by tests. "Not verified signed in" is a valid and useful statement.
