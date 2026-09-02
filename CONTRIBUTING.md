# Contributing to Steam Enhancer

Thanks for considering a contribution — issues, bug reports, and pull requests are all welcome.

## Before you start

- **No build step.** This is intentional. Don't introduce webpack/vite/tsc/a bundler unless there's a very strong reason and it's discussed in an issue first. The "edit a file, click reload" loop is the whole point of this codebase.
- **No ES modules in content scripts.** Every content/lib file attaches to `window.SteamEnhancer` (aliased `SE`) instead of using `import`/`export`. The background service worker is the only `"type": "module"` slot.
- **Read [`CLAUDE.md`](CLAUDE.md) first.** It's a full code-tour: repository layout, key conventions, the external-API table, and a running list of things to be careful about. It's written for both humans and AI coding assistants, and it's the fastest way to get oriented.

## Setting up a dev loop

1. Fork and clone the repo.
2. Visit `chrome://extensions/`, enable **Developer mode**, click **Load unpacked**, select the repo root.
3. Edit a file, then click the reload icon on the extension card (or reload the Steam tab if you only touched CSS/content scripts).
4. Before opening a PR, run `node scripts/smoke-test.js` (no dependencies, Node 18+) — it makes live, read-only requests to the Steam endpoints/pages the extension depends on and flags anything that's silently broken.

## Code conventions

- **All network calls go through the background service worker** via `SE.bg({ type: 'fetchJson', url, cacheKey, ttl })`. Never `fetch()` directly from a content script — it breaks caching and some CORS-sensitive endpoints.
- **Page-context access** (Steam's `g_ActiveInventory`, `g_sessionID`, etc.) goes through `SE.injectPage(fn)`, never read directly from the content script's isolated world.
- **DOM decoration**: prefix every injected class/id with `se-`. Mark decorated nodes with `dataset.seDone` so MutationObservers don't reprocess them.
- **Wrap features defensively.** Steam's markup changes without notice, and a lot of this codebase's selectors are best-effort. Use `SE.safe(label, fn)` around any feature that touches Steam's DOM so one broken selector can't take down the rest of the script. Prefer "silently do nothing" over throwing.
- **Settings**: add new toggles to the `DEFAULTS` object in both `src/lib/storage.js` and `src/options/options.js` — they're intentionally duplicated (no build step, no shared bundle) and must be kept in sync.
- **Don't ship API keys.** If a feature needs an authenticated endpoint, route it through a user-supplied key in the Options page (see `steamWebApiKey` for a template), never a key baked into the extension.
- **Don't widen `host_permissions`** without updating the justification table in both `CLAUDE.md` and `store-assets/description.md`.
- **Don't reuse code or assets from Augmented Steam or Steam Inventory Helper.** Their licenses differ from this project's MIT license, and re-implementation from scratch is the point.

## If you add a feature that depends on an undocumented Steam endpoint or a guessed CSS selector

This happens a lot in this codebase, because Steam has no public docs for most of what it exposes. Before shipping:

1. If possible, verify the endpoint/selector actually returns what you expect (a live request, or `scripts/smoke-test.js`).
2. If you can't verify it (e.g. it needs a logged-in session and you can't test one), say so explicitly in a code comment and wrap the feature in `SE.safe`.
3. Add a row to the external-API table in `CLAUDE.md` if it's a new endpoint.

## Reporting bugs

Open an issue with:
- The Steam page URL where it broke (or a redacted description if it's a private page like your own inventory)
- What you expected vs. what happened
- Console output, if any — filter for `[SteamEnhancer]`

## Pull requests

- Keep PRs focused — one feature or fix per PR is easier to review than a grab-bag.
- Update `CHANGELOG.md` under an `[Unreleased]` heading.
- Bump `version` in `manifest.json` only if you're also cutting a release (usually a maintainer will do this).

## License

By contributing, you agree your contributions are licensed under this project's [MIT license](LICENSE).
