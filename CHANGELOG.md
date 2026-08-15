# Changelog

All notable changes to Steam Enhancer are documented here. Versions follow the
`version` field in `manifest.json`.

## [1.2.0] — SIH/Augmented Steam depth pass

- **Fixed a codebase-wide crash bug**: `SE.el(tag, null, ...children)` — used
  extensively throughout the extension, including in this release's own new
  trade item table — threw a `TypeError` because JS default parameters only
  apply to `undefined`, not `null`. Root-caused and fixed once in `SE.el`.
- **Trade offers**: full item-by-item value breakdown table for both sides (not
  just totals), and a **local trade history** per partner (value-gap trend across
  offers you've composed with them in this browser — not a reputation service).
- **Inventory**: manual multi-select ("Select items to sell" → click tiles →
  editable per-item price → confirm) alongside the existing auto-median dry run;
  **sort tiles by estimated value**; **group tiles by item type**; **inventory
  value-over-time** sparkline built from your own "Estimate value" clicks;
  CS2 inspect links now use the exact per-asset inspect URL (via CSFloat's
  inspect-link intake) instead of a generic name search.
- **Market**: **buy-order helper** — reads Valve's own order-book endpoint
  (`itemordershistogram`) to suggest a queue-leading buy-order price and show
  the current spread.
- **Store pages**: **live review filtering** (min playtime hours, min word count,
  recommended/not) that re-filters already-rendered review cards instantly,
  alongside the existing reload-based quick filters; **bundle savings check** —
  compares a bundle's discounted price against its contents' standalone prices;
  **display-currency conversion** — an optional second currency shown next to
  ITAD price lines, independent of the Steam storefront's own currency.
- Shared `SE.sparklineSvg()` helper (dedupes the price-history and inventory
  value-history charts) and `SE.profileKeyFromPath()` (lets library.js and
  profile.js key shared local data to the same profile).
- `tradeoffer.js` had been missed by the previous hardening pass and was still
  using a one-shot `{ once: true }` listener; it now re-initializes on SPA
  navigation like every other content script.

## [1.1.1] — Hardening

- **Per-feature error isolation** (`SE.safe`): a broken selector in one feature no
  longer kills the rest of a content script.
- **SPA-aware re-initialization** (`SE.onReady` + `SE.once`): Steam navigates
  client-side on many routes; `se-ready` now re-fires on URL change while one-time
  side effects (intervals, observers, listeners) are guarded against stacking.
- **Safer mass-list**: the inventory "mass-list at median" tool is now a two-phase
  dry-run → explicit-confirm flow. Nothing is listed for sale until you confirm a
  rendered preview.
- **Trade hold-to-confirm escape**: a "use normal button" link guarantees you are
  never locked out of Steam's native confirm button.
- **Community tags** now read from the DOM Steam already renders instead of scraping
  an HTML endpoint (robust, no extra network call).
- **i18n for popup & options UI** (English + Hebrew, with RTL layout).
- Null-safe `SE.ctx` access across scripts.

## [1.1.0] — Feature expansion

- Inline SVG price-history sparkline on store pages.
- Library page (`/games/`): sort by playtime, "never played first", A→Z, unplayed
  filter, total-hours readout.
- Per-row wishlist price targets with "AT TARGET" highlighting.
- Trade-offer SteamRep / Backpack.tf / SteamID.uk badges and 2-second
  hold-to-confirm button.
- Inventory: mass-list at median, booster-pack creator link, CS2 sticker helper.
- Forum/discussion "quote selected text" popup.
- Keyboard shortcuts: `Ctrl+Shift+S` (toggle panel), `Ctrl+Shift+W` (wishlist),
  `Ctrl+Shift+I` (ITAD lookup).
- Changelog modal on install/update.
- i18n scaffolding (`_locales/en`, `_locales/he`).

## [1.0.0] — Initial release

- Store pages: lowest current price + historical low (ITAD), regional pricing,
  ProtonDB, HowLongToBeat, players online, achievement stats, owned-DLC highlight,
  trading-card links, review breakdown, external links (SteamDB/SteamCharts/Barter).
- Search/specials/sale: owned/wishlist/ignored highlighting + hide, historical-low
  badge, "hide forever" blocklist.
- Wishlist: CSV/JSON/text export, ITAD batch open, deal notifications.
- Market: net-after-fee, undercut calculator, currency converter.
- Inventory: value estimate, duplicate finder, JSON export.
- Trade offers: per-side value estimate + mismatch warning.
- Profile shortcuts, context-menu lookups, options page, popup, notes & blocklist.
