# Changelog

All notable changes to Steam Enhancer are documented here. Versions follow the
`version` field in `manifest.json`.

## [1.3.0] — Closing out the roadmap

Follow-up to the feature audit after 1.2.0: everything from the original
comparison-vs-Augmented-Steam/SIH roadmap that was marked "not built" or
"partial" is now built, with two documented exceptions (below) where I could
not verify a real free API exists and chose not to guess one.

- **Free-for-a-limited-time promo tracker**: new background alarm reads Steam's
  own `featuredcategories` feed (verified live) and notifies on 100%-off items.
- **Review-bomb heuristic**: reads Steam's own `appreviewhistogram` endpoint
  (verified live) and flags a large negative-review spike in the last 3 days
  vs. the longer-run monthly baseline, on store pages.
- **Store-page price alerts**: "Alert me at" field now also on the game page
  itself (previously wishlist-only), sharing storage with the wishlist targets;
  a new background alarm checks both and notifies on a hit.
- **Most-helpful review snippet** shown inline in the store-page panel.
- **Owned-by-friends** (opt-in): shows how many of your friends own the game,
  using your own Steam Web API key (Options page) — never a baked-in key.
  Resolves vanity URLs, samples up to 30 friends.
- **Library value estimate** on the `/games/` page (current storefront prices,
  explicitly labeled as such — Steam doesn't expose what you actually paid),
  shown on the profile page alongside game count/hours.
- **Badge completion tracker**: new `/badges/` page script summarizing XP,
  badges with progress, and which are closest to leveling up (per page shown —
  the badges list is paginated by Steam, and the summary says so).
- **Media shortcuts** (screenshots/videos/artwork/workshop) on profile pages.
- **CS2/TF2/Dota rarity-quality breakdown** report in the inventory toolbar.
- **~20 new granular per-feature settings** so each 1.2.0/1.3.0 addition can be
  toggled independently instead of only at the enableMarketTools/etc. level.
- **First-run onboarding tour** (fresh installs only; updates still get the
  changelog modal).
- **Smarter trade-offer polling**: the value cache already prevented redundant
  price lookups, but the whole DOM/table was still rebuilt every 2s regardless
  — now skipped entirely when the offer's contents haven't changed.
- **`chrome.storage.sync` quota errors surfaced** in the options page instead
  of failing silently (all settings live under one ~8KB-limited key).
- **New: `scripts/smoke-test.js`** — a standalone, dependency-free Node script
  that hits the live Steam endpoints/pages this codebase depends on and checks
  the assumed markup/response shapes are still there. Not part of the
  extension; run manually before releases.

**Investigated and deliberately not built** (verified via live requests, not
assumption): a full ITAD price-history endpoint (its docs 404'd) and a
key-free SteamRep/backpack.tf reputation-check API (both the docs page and the
long-standing `/api/beta4/reputation/` URL 404'd). Shipping a guessed
endpoint here would repeat the CSFloat mistake from 1.2.0 — the existing
profile-link shortcuts to SteamRep/backpack.tf are what's shipped instead.

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
