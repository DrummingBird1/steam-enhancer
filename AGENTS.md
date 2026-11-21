# Steam Enhancer

Single source of truth for any AI agent or contributor (Claude, Codex, Copilot, Cursor, Gemini, ChatGPT, Grok, OpenCode, a human) working in this repo. `CLAUDE.md` only imports this file. The long reference (layout, conventions, external-API table, pitfalls) is in **[`docs/agent-notes.md`](docs/agent-notes.md)**: read it before changing code. This file is the operational part: what the project is, how to run things, what is allowed, how work is handed over.

<!-- BEGIN core-rules v1 (generated from the shared core-rules.md; do not edit by hand) -->
## Core rules (apply to every agent)

- Read this file first. If `HANDOFF.local.md` exists next to it, read it too (local only, not in git).
- Never push, force-push or create remotes unless the owner explicitly asks. Work on a branch named `agent/<tool>-<topic>`; merge to `main` only through a pull request.
- Never commit or print secrets (`.env`, keys, tokens). Keep personal paths, emails and private repo names out of tracked files.
- Package managers: JavaScript uses `pnpm`, Python uses `uv`. Do not switch without being asked.
- Dev servers listen on `127.0.0.1` only, unless the owner asks otherwise.
- Do not delete or overwrite user data. Move it to an archive folder or ask first, and do a dry run before bulk changes.
- Make the smallest change that solves the task. Run this project's own check and test commands (see Run and Test in this file) and say what you ran and what you could not verify.
- If you have no access to the repository (a chat-only agent), return a unified diff or complete files, and list what the owner should verify.
<!-- END core-rules -->

## What this is

Steam Enhancer is an unofficial Manifest V3 Chrome extension that augments the Steam Store, Steam Community and Steam Market: price history, regional pricing, wishlist tooling, market and inventory helpers, trade-offer summaries and more, in one codebase with no build step. It is not affiliated with Valve, Augmented Steam or Steam Inventory Helper; all code is original (MIT). The owner works in Hebrew: reply in Hebrew unless asked otherwise; code, docs and commit messages stay in English.

## Run and test (quick start)

No build step, no dependencies for the checks (Node 18+).

```bash
node scripts/unit-test.js          # pure logic in src/lib, instant, no network
node scripts/check-manifest.js     # manifest file refs + every i18n key used in src/ exists
node scripts/gen-locales.js        # regenerate _locales/*/messages.json (then `git diff _locales/` must be what you intended)
node scripts/smoke-test.js         # live, read-only requests to public Steam endpoints (network)
node scripts/package.js            # builds dist/steam-enhancer-vX.Y.Z.zip (dist/ is git-ignored)
node scripts/package.js --firefox  # builds dist/steam-enhancer-firefox-vX.Y.Z.zip (experimental, not run in a real Firefox)
```

CI (`.github/workflows/ci.yml`) runs the first three on every PR. All must pass before merge.
Load the extension: `chrome://extensions` → Developer mode → Load unpacked → repo root.
Signed-in checks (`scripts/signed-in-check.js`) need playwright-core and a human who signs in; agents never handle Steam credentials.

## Rules that are easy to break

- **No build step, no ES modules in content scripts.** Files attach to `window.SteamEnhancer` (`SE`).
- **Network only through the service worker** (`SE.bg`). Page globals only through `SE.pageCall` + a named op in `src/content/page-bridge.js`.
- **i18n:** never hardcode UI text. Add keys to the table in `scripts/gen-locales.js`, run it, commit the generated `_locales/`. Never hand-edit `_locales/*/messages.json`.
- **Settings defaults live only in `src/lib/storage.js`.** Always go through `SE.storage`. Options UI comes from `SECTIONS` in `src/options/options.js` (+ an `opt_<key>` label). The few settings too big for sync's 8 KB item quota (`LOCAL_KEYS`) live in `chrome.storage.local`.
- **Injected DOM:** every node gets a class prefixed `se-`, and most get `dataset.seDone = '1'` so MutationObservers don't decorate the same row twice.
- **API keys are user-supplied** through Options (ITAD, Steam Web API); never bake one in. A new keyed endpoint follows the same pattern.
- **Never insert into Steam's React trees** (wishlist, new inventory pane, library, Market Beta). Float or sit beside; report with `SE.health.miss(...)`.
- **Money:** wallet currency via `SE.walletCurrency()`; refuse to list when unknown; `sellitem` takes the after-fee amount (`SE.marketFees`).
- **Big API answers are reduced in the service worker before caching** (`chrome.storage.local` is 10 MB).
- **Don't widen `host_permissions`**, don't ship API keys, don't copy code or assets from Augmented Steam / Steam Inventory Helper, keep the "unofficial" disclaimer in docs.
- If you add a pure helper to `src/lib/`, add a case to `scripts/unit-test.js`. If you add an endpoint, add a row to the table in `docs/agent-notes.md` and a check to `scripts/smoke-test.js` when it can be verified anonymously.

## This repo is public

Everything tracked is world-readable. Never commit local paths (drive letters or user-profile folders), emails, tokens/keys, personal notes or session transcripts. Private context goes in `*.local.md` files (git-ignored; `HANDOFF.local.md` is the convention). Check `git diff --cached --stat` before every commit.

## Git and release workflow

- Work on a branch (`feat/…`, `fix/…`, `docs/…`, `release/X.Y.Z`); `main` changes only through a PR.
- Don't push, merge, tag, publish a GitHub release or delete branches unless the maintainer asked for exactly that.
- Commit messages: short imperative subject, body says *why*. One concern per PR; update `CHANGELOG.md` under `[Unreleased]`.
- Release (maintainer-driven): bump `version` in `manifest.json` only → CHANGELOG section → `node scripts/package.js` → merge PR → tag `vX.Y.Z` → GitHub release with the ZIP → Chrome Web Store upload (human step). Store texts live in `store-assets/` (EN + `listing/{he,de,ru,pt_BR}.md`).

## Where things stand

- [`docs/agent-notes.md`](docs/agent-notes.md): the code tour (layout, conventions, external APIs, things to be careful about).
- [`ROADMAP.md`](ROADMAP.md): shipped / next / ideas / deliberately set aside (read "set aside" before proposing a feature).
- [`docs/`](docs): English-only technical notes (per-release plans and checklists are kept out of this public repo).
- [`CHANGELOG.md`](CHANGELOG.md): what each version contains.
- Known limits and what has *not* been verified signed in are listed in the release PR description and in the plan's status table.

## Handing work to the next agent

Before ending a session that leaves work half done, leave the repo in a state a stranger can pick up:

1. Commit (or clearly list) what is uncommitted; never leave the checks red without saying so.
2. Update the status table in the current local plan, kept outside the repo (done / not done / unverified).
3. Write the open items and the exact next command in the PR description or in `HANDOFF.local.md` (local only).
4. Say what you verified live vs. only by tests. "Not verified signed in" is a valid and useful statement.
