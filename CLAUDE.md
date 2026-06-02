# CLAUDE.md

This file gives Claude Code the context it needs to work productively in this repository.

## What this project is

**Steam Enhancer** is a Manifest V3 Chrome extension that augments the Steam Store, Steam Community, and Steam Market. It rolls together features inspired by the well-known browser extensions Augmented Steam and Steam Inventory Helper — price history, regional pricing, wishlist tooling, market/inventory helpers, trade-offer summaries, and so on — into a single MV3 codebase with no build step.

It is **not** affiliated with Valve, Augmented Steam, or Steam Inventory Helper. All code here is original and licensed under MIT (see `LICENSE`).

## Repository layout

```
manifest.json              MV3 manifest. Adds host permissions for store/community/ITAD/SteamDB/ProtonDB/HLTB.
src/
  background/service-worker.js   Network proxy with caching, context menus, wishlist deal alarm.
  lib/                           Loaded into every content script bundle (NOT ES modules).
    utils.js                     DOM helpers, parsePrice, message bridge, page-context injection.
    storage.js                   chrome.storage.sync settings + chrome.storage.local cache/collections.
    currency.js                  Country → currency map.
    api.js                       Thin wrappers around ITAD / Steam storefront / ProtonDB / HLTB calls.
    prices.js                    Composite "priceSummary(appid)" used by store pages.
  content/                       Page-specific content scripts.
    common.js                    Loads dynamicstore (owned/wishlist/ignored), dispatches `se-ready`.
    app.js                       Store /app/, /sub/, /bundle/ pages.
    search.js                    /search/, /specials/, /sale/ — row decoration + price tags.
    wishlist.js                  Wishlist toolbar + export.
    market.js                    Steam Community market.
    inventory.js                 Community inventory tools (uses g_ActiveInventory via page injection).
    profile.js                   User-profile external links.
    tradeoffer.js                Trade-offer summary panel.
  popup/                         Toolbar popup (quick toggles + jump-to links).
  options/                       Full settings page.
  styles/injected.css            All injected DOM is scoped under `.se-*` class names.
icons/                           16/32/48/128 PNGs (generated, not hand-drawn).
store-assets/                    Chrome Web Store screenshots, promo images, listing text.
```

## Key conventions

- **No build step.** Files are loaded directly by Chrome. Don't add a bundler unless there's a strong reason.
- **No ES modules in content scripts.** Each file attaches to `window.SteamEnhancer` (aliased as `SE`). The background service worker is the only `"type": "module"` slot, but currently uses plain JS.
- **All network calls go through the background SW** via `SE.bg({ type: 'fetchJson', url, cacheKey, ttl })`. This centralizes caching and keeps CORS-sensitive endpoints working. Do not `fetch()` from a content script.
- **Page-context access** (Steam's `g_ActiveInventory`, `g_sessionID`, etc.) uses `SE.injectPage(fn)` which appends a `<script>` and round-trips via `postMessage`. Don't try to read those directly from the isolated world.
- **DOM decoration**: every injected node gets a class prefixed `se-` and most receive a `dataset.seDone = '1'` flag so MutationObservers don't re-decorate the same row.
- **Settings** live under `chrome.storage.sync` key `se_settings_v1` and are read once on `se-ready`. Defaults are duplicated in `src/lib/storage.js` and `src/options/options.js` — keep them in sync if you change them.
- **Cache** lives under `chrome.storage.local` key `se_bg_cache_v1` (background) and `se_cache_v1` (content, currently unused — prefer the background cache). TTL is per-entry in minutes.

## External APIs used

| Service | Why | Auth |
|---|---|---|
| `api.isthereanydeal.com` v2 | Current/historical lowest prices | None (public lookup endpoints) |
| `store.steampowered.com/api/appdetails` | Regional pricing | Cookie-based (we include credentials) |
| `api.steampowered.com` GetNumberOfCurrentPlayers / GetGlobalAchievementPercentagesForApp | Player count, achievement rarity | None |
| `steamcommunity.com/market/priceoverview` | Market item value | Steam session cookie |
| `protondb.com` summary API | Linux compat rating | None |
| `howlongtobeat.com` search API | Playtime estimates | None (anti-bot may break this) |
| `store.steampowered.com/dynamicstore/userdata/` | Owned / wishlist / ignored ids | Steam session cookie |

If an endpoint breaks (HLTB especially), the relevant feature should degrade to a search link rather than throw.

## How to load locally

1. Visit `chrome://extensions/`.
2. Enable Developer mode.
3. "Load unpacked" → select the repo root.
4. Open any Steam store/community page to see the injected panels.

## Things to be careful about

- **`hideOwnedInSearch` / `hideIgnoredInSearch`** mutate `display: none` on Steam's lazy-loaded rows. If Steam restructures those classes, the filter silently does nothing — that's expected, not a bug to chase.
- **Trade offer / inventory features** rely on Steam's page-context globals. Anything reading from there must go through `SE.injectPage`. The community pages also re-render constantly; use `setInterval` polling sparingly, prefer MutationObserver scoped to a small subtree.
- **Wishlist deal notifications** are best-effort: we sample the first 50 wishlisted appids per hour to stay polite to ITAD. Don't raise that cap without coordinating.
- **Don't ship API keys.** ITAD v2 lookup endpoints used here are key-free; if you add a keyed endpoint, route it through a user-supplied key in options, not a baked-in secret.
- Markdown docs (`README.md`, `store-assets/description.md`) reference the *unofficial* status — keep that disclaimer when editing.

## Versioning & release

- Bump `version` in `manifest.json` only (no separate package.json).
- Tag releases as `vX.Y.Z`.
- `store-assets/` holds the Chrome Web Store listing copy and graphics — update screenshots when UI changes meaningfully.

## What not to do

- Don't reuse code or assets from Augmented Steam / Steam Inventory Helper. Their licenses differ and re-implementation is the whole point.
- Don't add a build step (webpack/vite/tsc) unless asked. The "edit, reload, test" loop is the win here.
- Don't widen `host_permissions`. Each entry is justified in the table above.
