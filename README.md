# Steam Enhancer

[![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Latest release](https://img.shields.io/github/v/release/DrummingBird1/steam-enhancer?include_prereleases)](https://github.com/DrummingBird1/steam-enhancer/releases)
[![Issues](https://img.shields.io/github/issues/DrummingBird1/steam-enhancer)](https://github.com/DrummingBird1/steam-enhancer/issues)

**🌐 עברית: [README.he.md](README.he.md)**

🗺 **Planned work: see [ROADMAP.md](ROADMAP.md).**

**Steam Enhancer** is an all-in-one Chrome extension that adds the most-loved features of *Augmented Steam* and *Steam Inventory Helper* into one clean, original, Manifest V3 codebase — with no build step and no telemetry.

> Unofficial. Not affiliated with Valve, Augmented Steam, or Steam Inventory Helper.

Current version: **1.5.0** — see [`CHANGELOG.md`](CHANGELOG.md) or the [Releases page](https://github.com/DrummingBird1/steam-enhancer/releases) for the full history.

There is no separate project website yet — this repository (and, once published, the Chrome Web Store listing) is the canonical home for the project.

> **Price features need a free IsThereAnyDeal API key** (lowest price, historical low, full price history, search/wishlist price tags, deal alerts). IsThereAnyDeal requires one for every app using their API. Register a free app at [isthereanydeal.com/apps/my/](https://isthereanydeal.com/apps/my/) and paste its key into **Options → Prices & keys**. Without it, those features show a short notice with a link to Options.

## Features

### Store pages (`/app/`, `/sub/`, `/bundle/`)
- 💸 **Lowest current price** across stores and **Steam's historical low** (via IsThereAnyDeal), with an optional second **display currency**
- 📈 **Interactive price-history chart** — Steam's price over three years, hover for date and price, 3M / 1Y / All ranges, a line at the lowest price. Without an ITAD key it charts the prices you've seen on your own visits
- 🌍 **Regional prices in your currency** — a dozen regions converted to one currency, cheapest first, each compared to your own price
- 🔔 **Price alerts** — set a target right on the game page (shared with the wishlist) and get notified when it's hit
- 🎯 **Near-low alerts** (opt-in) when a wishlisted game is within X% of its historical low, per-game **mute**, and how long the current price has held and when it last dropped
- 🎒 **Bundle check** — buying separately vs. the bundle price
- 🎮 **Steam Deck status** (Verified / Playable / Unsupported) and 🐧 **ProtonDB rating**
- 🏆 **Achievement stats** (count, easiest, rarest) and **your own progress** for games you own (with your Steam Web API key)
- 📜 A **full achievements list** with global unlock percentages
- 👥 **Players online now**, 👫 **friends who own it** (opt-in, your own Steam Web API key)
- 📊 Review breakdown, **most-helpful review**, **possible review-bomb flag**, and a **live review filter** (playtime, length, recommended or not) — all of these work whatever language your Steam is in
- 🧩 Owned-DLC highlighting, owned items in packages, DRM / Early Access / Coming Soon badges, community tags
- 🃏 Trading-card links, ⏱ HowLongToBeat, 🔗 SteamDB, SteamCharts, Barter.vg, SteamSpy, SteamGifts, SteamTrades
- 📝 Private per-game notes

### Search, specials, sales
- 🟩 Highlight **owned**, **wishlisted** and **ignored** games
- 🙈 Hide owned / ignored games, or hide any single game for good
- 🏷 **Historical-low tag** on each result, in the same currency as the price next to it

### Wishlist
A panel above Steam's own wishlist, built from Steam's wishlist and store data — works on anyone's public wishlist:
- 📋 One table: price, discount, historical low and how far above it you are, reviews, Steam Deck status, your alert price, date added
- 🧮 Summary: total now vs. full price, how many are on sale, at their historical low, or at your alert price
- 🔎 Search, 8 sort orders, filters (on sale, at historical low, at my target, max price)
- 📤 Export what's shown to **CSV / JSON**, or copy it as a list
- 🔔 Background check of the **whole wishlist** (up to 500 games) — each deal is announced once

### Steam Community Market
- 💰 **What you'd actually receive** after Steam's fees, on every listing (Steam's own fee rounding)
- 📋 **My listings check** — each of your listings marked LOWEST or UNDERCUT by how much; select the undercut ones and remove them together
- ✂️ Undercut calculator, 💹 buy-order helper (the real order book), 📈 price-history chart — also on Steam's new **Market Beta** item page (the order book is read by name, so no order-book id is needed)
- 💱 Currency converter

### Inventory
- ⚡ **Quick sell** (one cent under the cheapest listing) and **Instant sell** (to the highest buy order) for the selected item
- ☑️ **Multi-select selling** and **list at median** — each item shows *buyer pays / you receive* in your wallet currency, and nothing is listed without your explicit confirm click Mass-list can **keep N copies** of every item.
- 💎 Inventory value estimate with a value-over-time chart · 👯 duplicates · 🗂 sort by value, group by type, rarity breakdown
- 📝 Private per-item notes (kept in your browser); value history per game
- 🃏 Card-set progress, booster-pack creator, CS2 sticker prices and exact-item inspect links

### Trade offers
- 📊 **Item-by-item value table** for both sides — including Steam items (cards, gems)
- 🕓 Local trade history per partner (value gap across offers in this browser)
- 🛡 SteamRep / Backpack.tf / SteamID.uk shortcuts, hold-to-confirm button

### Profiles, library (`/games/`) and badges (`/badges/`)
- Shortcuts to SteamDB calculator, SteamLadder, Backpack.tf, SteamRep; media shortcuts
- Sort by playtime, unplayed filter, **library value estimate**; badge / XP summary

### Everywhere
- 🔔 **Notification center** — every alert kept in the toolbar popup with an unread badge; click one to open the game; **quiet hours**
- 🩺 **Report a problem**: a copy-only diagnostic (nothing is sent), and a note when a tool can't find its place after Steam changes a page
- ♿ Keyboard focus, labelled dialogs, live status text and better contrast
- ⚙️ **Settings page** with search, presets (Minimal / Deal hunter / Trader / Everything), saves as you go, full **backup & restore**, custom CSS
- 🖱 Right-click lookups, floating **SE** badge, keyboard shortcuts (`Alt+Shift+S/W/D`)
- 🌐 Prices follow the country Steam shows you (or your own choice); English, Hebrew (RTL), Russian, German, Portuguese (Brazil)

## Install

### From the Chrome Web Store
*(Listing pending — see `store-assets/` for the submission package.)*

### Load unpacked (developer mode)
1. Clone or download this repo.
2. Visit `chrome://extensions/`.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the repo root.
5. Open any Steam store or community page — you'll see the **SE** badge bottom-right.

## Privacy

Steam Enhancer **does not collect, transmit, or sell any personal data**. Settings live in Chrome's own storage (`storage.sync`, plus `storage.local` for custom CSS and the data the extension keeps for you) and never go to us. Network requests are made directly from your browser to:

- Steam (storefront, community, market, and the public wishlist / store-item Web APIs) — only when you're on a Steam page, or for the background checks you turn on
- IsThereAnyDeal — only to look up prices for the games you're viewing (or have alerts on), using **your own free API key** (Options → Prices & keys); never baked into the extension
- ProtonDB — only on store pages, only for the visible app
- `open.er-api.com` — only for the currency converter / display-currency conversion
- `api.steampowered.com` friends / owned-games / your-achievements lookups — **only if you supply your own Steam Web API key** in Options; never sent anywhere but Steam's own API, never baked into the extension

No analytics. Background alarms (all off by default, all toggleable in Options): an hourly wishlist / price-alert check and a two-hourly free-promo check — read-only lookups against Steam and ITAD, nothing sent about you beyond the app IDs being checked.

Selling and removing market listings only ever happens on your own click, after a confirmation that shows exactly what the buyer pays and what you receive.

Full privacy policy: [`store-assets/privacy-policy.md`](store-assets/privacy-policy.md).

## Development

See [`CLAUDE.md`](CLAUDE.md) for a code-tour written for both humans and AI assistants.

```
src/
  background/        MV3 service worker (network proxy + cache + alarms)
  content/           Per-page content scripts
  lib/               Shared utilities (DOM, storage, API clients)
  popup/             Toolbar popup
  options/           Settings page
  styles/            Injected CSS (all .se-* prefixed)
scripts/
  smoke-test.js       Live regression check against real Steam/ITAD endpoints (see CLAUDE.md)
  signed-in-check.js  Signed-in regression run in a real browser: you sign in, it only reads (see the file header)
  unit-test.js        Pure-logic tests (prices, fees, API parsers, wishlist, chart…) — no network, instant
  check-manifest.js   Manifest file references and i18n keys
  gen-locales.js      Regenerates all _locales/*/messages.json from one source table
  package.js          Builds the Chrome Web Store ZIP into dist/
```

No build step — edit a file and click "reload" in `chrome://extensions/`. Run `node scripts/smoke-test.js` to sanity-check the live endpoints/selectors this extension depends on, and `node scripts/unit-test.js` for the pure-logic tests. CI runs the unit tests and checks on every pull request.

**Languages:** the extension UI is available in English, Hebrew (RTL), Russian, German, and Portuguese (Brazil) — Chrome picks one automatically based on your browser's language. To add or fix a translation, edit the table in `scripts/gen-locales.js` and re-run it; don't hand-edit the `_locales/*/messages.json` files directly, since they're generated and will be overwritten.

## Contributing

Issues and PRs welcome — see [`CONTRIBUTING.md`](CONTRIBUTING.md) for the full guide (dev loop, code conventions, how to handle undocumented Steam endpoints). Short version:
- Don't import code from other Steam extensions (license cleanliness matters).
- Keep all DOM injections under the `se-` class prefix.
- Route all `fetch` through the background service worker.
- No build step, no ES modules in content scripts — see [`CLAUDE.md`](CLAUDE.md) for why.

[Open an issue](https://github.com/DrummingBird1/steam-enhancer/issues) · [See past releases](https://github.com/DrummingBird1/steam-enhancer/releases)

## License

MIT — see [`LICENSE`](LICENSE).

## Acknowledgements

Inspired by the excellent work of the [Augmented Steam](https://github.com/IsThereAnyDeal/AugmentedSteam) and [Steam Inventory Helper](https://chromewebstore.google.com/) communities. This is an independent reimplementation, not a fork.

Trademarks: "Steam" is a trademark of Valve Corporation. This project is not affiliated with or endorsed by Valve.

## Support

If this project is useful to you, you can support its development:

[Ko-fi](https://ko-fi.com/idanlights) · [Buy Me a Coffee](https://buymeacoffee.com/MrIdan) · [Patreon](https://www.patreon.com/c/IdanLights)
