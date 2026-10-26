# Steam Enhancer

[![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Latest release](https://img.shields.io/github/v/release/DrummingBird1/steam-enhancer?include_prereleases)](https://github.com/DrummingBird1/steam-enhancer/releases)
[![Issues](https://img.shields.io/github/issues/DrummingBird1/steam-enhancer)](https://github.com/DrummingBird1/steam-enhancer/issues)

**🌐 עברית: [README.he.md](README.he.md)**

**Steam Enhancer** is an all-in-one Chrome extension that adds the most-loved features of *Augmented Steam* and *Steam Inventory Helper* into one clean, original, Manifest V3 codebase — with no build step and no telemetry.

> Unofficial. Not affiliated with Valve, Augmented Steam, or Steam Inventory Helper.

Current version: **1.4.0** — see [`CHANGELOG.md`](CHANGELOG.md) or the [Releases page](https://github.com/DrummingBird1/steam-enhancer/releases) for the full history.

There is no separate project website yet — this repository (and, once published, the Chrome Web Store listing) is the canonical home for the project.

> **⚠ If you're updating from an earlier version:** IsThereAnyDeal now requires a free API key for every price feature (lowest price, historical low, price-history chart, search/wishlist price tags, deal notifications) — this changed on their end, not something this project chose. Get a free key at [isthereanydeal.com/apps/my/](https://isthereanydeal.com/apps/my/) (registers the extension, not you personally) and paste it into **Options → IsThereAnyDeal API key**. Without it, those features show a message pointing you here instead of just going quiet.

## Features

### Store pages (`/app/`, `/sub/`, `/bundle/`)
- 💸 **Lowest current price** across stores (via IsThereAnyDeal), with an optional second **display currency**
- 📉 **Historical low** with shop, date, discount, and an inline price-history sparkline
- 🔔 **Price alerts** — set a target price right on the game page (shared with wishlist alerts) and get notified when it's hit
- 🎁 **Free-for-a-limited-time promo** notifications
- 🌍 **Regional pricing** preview (US, AR, TR, RU, IN, BR)
- 🎒 **Bundle savings check** — buying separately vs. the bundle price
- 🐧 **ProtonDB rating** for Linux/Deck players
- ⏱ **HowLongToBeat** shortcut
- 👥 **Players online right now**, 👫 **owned-by-friends count** (opt-in, your own Steam Web API key)
- 🏆 **Achievement stats** (count, easiest, rarest)
- 🧩 **Owned-DLC highlight** + count, **owned-in-bundle highlight**
- 🃏 **Trading-card links** (Market + SteamCardExchange)
- 🔗 SteamDB, SteamCharts, Barter.vg, SteamSpy, SteamGifts, SteamTrades quick links
- 📊 Review breakdown, **most-helpful review snippet**, **possible review-bomb flag**, and a **live filter bar** (min playtime, min length, recommended/not) that re-filters loaded reviews with no page reload
- 📝 Private per-game notes, DRM/early-access/coming-soon badges, community tags

### Search, specials, sale pages
- 🟩 Highlight **owned**, **wishlisted**, and **ignored** games
- 🙈 Optionally **hide owned / hide ignored**, or hide any single game forever
- 🏷 Show **historical-low price** badge on each result

### Wishlist
- 📤 Export wishlist to **CSV / JSON / clipboard text**
- 🔍 Open as a batch on IsThereAnyDeal
- 🎯 **Per-row price targets** with notifications, sort by best-deal-vs-low

### Steam Community Market
- 💰 Auto-show **net amount after the 15% market fee** on every listing
- ✂️ **Undercut calculator**, 💹 **buy-order helper** (reads the real order book)
- 💱 Built-in currency converter

### Inventory
- 💎 **Estimate inventory value** (with a value-over-time chart) · 👯 **find/mark duplicates**
- 🗂 **Sort by value, group by type, rarity/quality breakdown**
- ☑️ **Manual multi-select selling** — pick items, edit each price, confirm — or auto-list at median (both are dry-run-then-confirm, nothing lists without your explicit click)
- 🃏 Card-set progress, booster-pack creator, CS2 sticker prices & exact-item inspect links

### Trade offers
- 📊 **Item-by-item value table** for both sides, not just a total
- 🕓 **Local trade history** per partner (value-gap trend across offers in this browser)
- 🛡 SteamRep/Backpack.tf/SteamID.uk shortcuts, hold-to-confirm button

### Profile pages
- Shortcut chips to **SteamDB calculator, SteamLadder, Backpack.tf, SteamRep**
- 📚 Library size/value snapshot, 🏅 badge count, 🖼 media (screenshots/videos/artwork/workshop) shortcuts

### Library (`/games/`) & Badges (`/badges/`) pages
- Sort by playtime, unplayed-only filter, **library value estimate**
- Per-page badge/XP summary, closest-to-next-level list

### Browser-wide
- 🖱 **Context-menu lookups**, floating **SE** settings badge, keyboard shortcuts (`Ctrl+Shift+S/W/I`)
- ⚙️ Full options page + popup, with **~35 independent feature toggles**
- 🌐 Configurable country / currency / display currency
- 👋 First-run onboarding tour, changelog on update

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

Steam Enhancer **does not collect, transmit, or sell any personal data**. All settings live in `chrome.storage.sync` and never leave your browser. Network requests are made directly from your browser to:

- Steam (storefront, community, market) — only when you're on a Steam page
- IsThereAnyDeal — only to look up prices for the app you're viewing, using **your own free API key** (Options → IsThereAnyDeal API key, required as of v1.4.0 — see the note above); never baked into the extension
- ProtonDB — only on store pages, only for the visible app
- HowLongToBeat — only when you click the HLTB link
- `open.er-api.com` — only for the currency converter / display-currency conversion
- `api.steampowered.com` friends/owned-games lookups — **only if you opt in and supply your own Steam Web API key** in Options; never sent anywhere but Steam's own API, never baked into the extension

No analytics. Background alarms (all off by default, all toggleable in Options): an hourly wishlist/price-target deal check, and a two-hourly free-promo check — both read-only lookups against Steam/ITAD, nothing sent about you beyond the app IDs being checked.

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
  unit-test.js        Pure-logic tests (parsePrice, sparklineSvg, etc.) — no network, instant
  gen-locales.js       Regenerates all _locales/*/messages.json from one source table
```

No build step — edit a file and click "reload" in `chrome://extensions/`. Run `node scripts/smoke-test.js` to sanity-check the live endpoints/selectors this extension depends on, and `node scripts/unit-test.js` for the pure-logic tests.

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
