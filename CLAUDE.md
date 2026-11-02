# CLAUDE.md

This file gives Claude Code the context it needs to work productively in this repository.

## What this project is

**Steam Enhancer** is a Manifest V3 Chrome extension that augments the Steam Store, Steam Community, and Steam Market. It rolls together features inspired by the well-known browser extensions Augmented Steam and Steam Inventory Helper — price history, regional pricing, wishlist tooling, market/inventory helpers, trade-offer summaries, and so on — into a single MV3 codebase with no build step.

It is **not** affiliated with Valve, Augmented Steam, or Steam Inventory Helper. All code here is original and licensed under MIT (see `LICENSE`).

## Repository layout

```
manifest.json              MV3 manifest. Host permissions: Steam store/community/Web API, ITAD API, ProtonDB, open.er-api.com.
src/
  background/service-worker.js   Network proxy (per-entry cache, per-endpoint pacing), context menus, alarms.
  lib/                           Loaded into every content script bundle (NOT ES modules).
    utils.js                     DOM helpers, parsePrice, message bridge, page-context injection.
    storage.js                   chrome.storage.sync settings + chrome.storage.local cache/collections.
    currency.js                  Country/currency maps, Steam currency ids, SE.walletCurrency, SE.effectiveCountry.
    api.js                       Thin wrappers around ITAD / Steam storefront / ProtonDB calls.
    itad.js                      Pure parsers for ITAD responses. Shared with the service worker (attaches to globalThis).
    wishlist.js                  Pure wishlist model (API parsing, rows, sort/filter, CSV). Loaded only on wishlist pages.
    prices.js                    Composite "priceSummary(appid)" used by store pages.
  content/                       Page-specific content scripts.
    page-bridge.js               Runs in the page's MAIN world; named ops reading Steam globals (see SE.pageCall).
    common.js                    Loads dynamicstore (owned/wishlist/ignored), dispatches `se-ready`, onboarding/changelog modals.
    app.js                       Store /app/, /sub/, /bundle/ pages — the biggest file; most store-page panels live here.
    search.js                    /search/, /specials/, /sale/ — row decoration + price tags.
    wishlist.js                  Wishlist panel: table built from Steam's wishlist + store APIs (the page itself is React).
    market.js                    Steam Community market — net-fee, undercut, buy-order helper.
    inventory.js                 Community inventory tools (uses g_ActiveInventory via page injection).
    profile.js                   User-profile shortcuts, library/badge summaries, media links.
    library.js                   /games/ page — sort/filter, library value estimate.
    badges.js                    /badges/ page — per-page badge/XP summary.
    tradeoffer.js                Trade-offer summary panel, item table, local trade history.
    discussions.js                Forum "quote selected text" popup.
  popup/                         Toolbar popup (quick toggles + jump-to links).
  options/                       Full settings page.
  styles/injected.css            All injected DOM is scoped under `.se-*` class names.
icons/                           16/32/48/128 PNGs (generated, not hand-drawn).
store-assets/                    Chrome Web Store screenshots, promo images, listing text.
scripts/smoke-test.js            Standalone Node script (no deps) that hits live, public Steam
                                  endpoints/pages and checks the selectors/endpoints this codebase
                                  depends on are still present. Not loaded by the extension. Run it
                                  with `node scripts/smoke-test.js` before a release or when
                                  something seems broken after a Steam redesign.
scripts/unit-test.js             Standalone Node script (no deps) testing the pure, non-DOM logic
                                  in src/lib/utils.js (parsePrice, sparklineSvg, etc.) by loading
                                  it into a vm sandbox. No network, runs instantly. Run with
                                  `node scripts/unit-test.js`.
scripts/gen-locales.js           Regenerates every _locales/*/messages.json from one source table.
                                  Edit the table in this file, not the JSON files directly — they're
                                  generated output and get overwritten.
```

## Key conventions

- **No build step.** Files are loaded directly by Chrome. Don't add a bundler unless there's a strong reason.
- **No ES modules in content scripts.** Each file attaches to `window.SteamEnhancer` (aliased as `SE`). The background service worker is the only `"type": "module"` slot, but currently uses plain JS.
- **All network calls go through the background SW** via `SE.bg({ type: 'fetchJson', url, cacheKey, ttl })`. This centralizes caching and keeps CORS-sensitive endpoints working. Do not `fetch()` from a content script.
- **Page-context access** (Steam's `g_ActiveInventory`, `g_sessionID`, etc.) uses `SE.pageCall('op', args)`, which round-trips via `postMessage` to `src/content/page-bridge.js` (a `"world": "MAIN"` content script). To read something new, add a named op there — nothing is eval'd or injected as inline `<script>`. Don't try to read those globals directly from the isolated world.
- **DOM decoration**: every injected node gets a class prefixed `se-` and most receive a `dataset.seDone = '1'` flag so MutationObservers don't re-decorate the same row.
- **Settings** live under `chrome.storage.sync` key `se_settings_v1` and are read once on `se-ready`. Defaults live only in `src/lib/storage.js`; the popup and options pages load that file too.
- **Cache** lives in the background only, one `chrome.storage.local` key per entry (`c:<cacheKey>`), pruned by the `se-cache-prune` alarm. TTL is per-entry in minutes. Identical in-flight requests share one fetch.
- **Money**: market prices are in the user's wallet currency (`SE.walletCurrency()`), and anything that lists items for sale must refuse when `known` is false. Use `SE.marketFees` for buyer-pays/seller-receives — `sellitem` takes the after-fee amount.
- **Price country** is `SE.ctx.country`: the Options override, else the country Steam reports on the page (`#application_config`), else `us`.
- **i18n**: content-script UI text goes through `SE.t('key')` (defined in `src/lib/i18n.js`), never a hardcoded string. Add new keys to the table in `scripts/gen-locales.js` and re-run it — don't hand-edit `_locales/*/messages.json`. Popup/options HTML uses `data-i18n="key"` attributes read by each page's own `localize()`.

## External APIs used

**IsThereAnyDeal (`api.isthereanydeal.com`) requires an API key on every endpoint as of v1.4.0** — verified live, all four endpoints below return `403 Missing api key` anonymously. The key is registered per-*application* at [isthereanydeal.com/apps/my/](https://isthereanydeal.com/apps/my/) (free, identifies the extension, not a personal credential) but is still routed through a user-supplied Options field (`itadApiKey`) rather than baked in, since we can't register on a user's behalf. `service-worker.js`'s `withItadKey()` attaches it centrally to every `api.isthereanydeal.com` request — content scripts never handle the key directly, and get `{ needsItadKey: true }` back if none is configured.

| Service | Why | Auth |
|---|---|---|
| `api.isthereanydeal.com` v2 (lookup/prices/storelow/history) | Current lowest, Steam historical low, price-history chart | **User-supplied ITAD API key (Options → IsThereAnyDeal API key), required since v1.4.0** |
| `store.steampowered.com/api/appdetails` | Regional pricing | Cookie-based (we include credentials) |
| `api.steampowered.com` GetNumberOfCurrentPlayers / GetGlobalAchievementPercentagesForApp | Player count, achievement rarity | None |
| `steamcommunity.com/market/priceoverview` | Market item value | Steam session cookie |
| `protondb.com` summary API | Linux compat rating | None |
| `api.steampowered.com` IWishlistService/GetWishlist | Wishlist panel: whose wishlist, priority, date added | None (public wishlists only) |
| `api.steampowered.com` IStoreBrowseService/GetItems | Wishlist panel: names, prices, discounts, reviews, Steam Deck category (100 apps per call) | None |
| `store.steampowered.com/dynamicstore/userdata/` | Owned / wishlist / ignored ids | Steam session cookie |
| `store.steampowered.com/api/featuredcategories` | Free-promo detection (100%-off specials) | None |
| `store.steampowered.com/appreviewhistogram/{appid}` | Review-bomb heuristic (recommendation counts over time) | None |
| `steamcommunity.com/market/itemordershistogram` | Buy-order helper (order-book depth) | Steam session cookie; `item_nameid` is scraped from a `Market_LoadOrderSpread(...)` inline script on the listing page — **verified anonymous requests don't render this script at all** (see `scripts/smoke-test.js`), so it's untested against a real logged-in session |
| `api.steampowered.com` GetFriendList / GetOwnedGames / ResolveVanityURL | Opt-in "owned by friends" | User-supplied Steam Web API key (Options page), never baked in |
| `steamcommunity.com/market/pricehistory` | Market item price-history chart | Steam session cookie — **verified anonymous requests get `400` with an empty body**; only works logged in (see `smoke-test.js`) |

If an endpoint breaks, the relevant feature should degrade to a search link rather than throw. HowLongToBeat's API blocks extensions (403), so it's a search link only and has no host permission.

One endpoint I *didn't* wire up after trying to verify it — don't re-add without re-checking first: a key-free SteamRep/backpack.tf reputation API (both docs and the classic `/api/beta4/reputation/` URL 404'd). The existing profile-link-based SteamRep/backpack.tf shortcuts are what's shipped instead.

## How to load locally

1. Visit `chrome://extensions/`.
2. Enable Developer mode.
3. "Load unpacked" → select the repo root.
4. Open any Steam store/community page to see the injected panels.

## Checking for breakage

Run `node scripts/smoke-test.js` (no deps, Node 18+) before a release or whenever
a feature that used to work stops working. It hits the live, public endpoints
and pages this codebase depends on and checks the patterns are still there. A
`FAIL` means go fix that feature; a `WARN` means the check needs a logged-in
session to be meaningful and this anonymous script can't fully verify it —
follow the note printed with it.

Run `node scripts/unit-test.js` for the pure-logic side (parsePrice,
marketFees, ITAD parsers against `scripts/fixtures/`, currency helpers,
sparklineSvg, fmtPercent, formatMoney, profileKeyFromPath, and a standing
regression test for the `SE.el(tag, null, …)` crash from 1.2.0) — instant, no
network. This is what caught the `parsePrice` thousands-separator bug in
v1.4.0 that four minor versions of manual testing hadn't. If you touch
`utils.js`'s pure helpers, add a case here rather than only relying on the
live smoke test.

`node scripts/check-manifest.js` checks manifest file references and that every
i18n key used in `src/` exists. CI (`.github/workflows/ci.yml`) runs both plus a
locale-drift check on every PR.

There's no browser-based test suite here (no build step, no CI browser), so
these two scripts plus manual DevTools checks are the whole
regression-detection story.

## Things to be careful about

- **`hideOwnedInSearch` / `hideIgnoredInSearch`** mutate `display: none` on Steam's lazy-loaded rows. If Steam restructures those classes, the filter silently does nothing — that's expected, not a bug to chase.
- **Trade offer / inventory features** rely on Steam's page-context globals. Anything reading from there must go through `SE.pageCall`. The community pages also re-render constantly; use `setInterval` polling sparingly, prefer MutationObserver scoped to a small subtree.
- **Wishlist deal / price-alert notifications** check up to 500 apps per hourly run (`MAX_POLLED_APPS` in the service worker): ITAD lookups are cached a day and prices are batched 200 per call. Each deal is announced once (again only if it deepens).
- **The wishlist page is a React app.** Never insert into its tree (`#StoreTemplate`); the panel goes beside it, and data comes from the APIs, not the DOM.
- **Don't ship API keys.** As of v1.4.0, ITAD v2 endpoints require a key (`itadApiKey` setting) and the opt-in friends-ownership feature requires a Steam Web API key (`steamWebApiKey`) — both are user-supplied via Options, never baked in. If you add another keyed endpoint, follow the same pattern.
- Markdown docs (`README.md`, `store-assets/description.md`) reference the *unofficial* status — keep that disclaimer when editing.

## Versioning & release

- Bump `version` in `manifest.json` only (no separate package.json).
- Tag releases as `vX.Y.Z`.
- `store-assets/` holds the Chrome Web Store listing copy and graphics — update screenshots when UI changes meaningfully.

## What not to do

- Don't reuse code or assets from Augmented Steam / Steam Inventory Helper. Their licenses differ and re-implementation is the whole point.
- Don't add a build step (webpack/vite/tsc) unless asked. The "edit, reload, test" loop is the win here.
- Don't widen `host_permissions`. Each entry is justified in the table above.
