# Steam Enhancer

[![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**Steam Enhancer** is an all-in-one Chrome extension that adds the most-loved features of *Augmented Steam* and *Steam Inventory Helper* into one clean, original, Manifest V3 codebase — with no build step and no telemetry.

> Unofficial. Not affiliated with Valve, Augmented Steam, or Steam Inventory Helper.

## Features

### Store pages (`/app/`, `/sub/`, `/bundle/`)
- 💸 **Lowest current price** across stores (via IsThereAnyDeal)
- 📉 **Historical low** with shop, date, and discount
- 🌍 **Regional pricing** preview (US, AR, TR, RU, IN, BR)
- 🐧 **ProtonDB rating** for Linux/Deck players
- ⏱ **HowLongToBeat** shortcut
- 👥 **Players online right now**
- 🏆 **Achievement stats** (count, easiest, rarest)
- 🧩 **Owned-DLC highlight** + count
- 🃏 **Trading-card links** (Market + SteamCardExchange)
- 🔗 SteamDB, SteamCharts, Barter.vg quick links
- 📊 Review breakdown (positive / negative counts)

### Search, specials, sale pages
- 🟩 Highlight **owned**, **wishlisted**, and **ignored** games
- 🙈 Optionally **hide owned / hide ignored**
- 🏷 Show **historical-low price** badge on each result
- ✓ Mark rows that are currently at their all-time low

### Wishlist
- 📤 Export wishlist to **CSV / JSON / clipboard text**
- 🔍 Open as a batch on IsThereAnyDeal
- 📈 Live count of visible items
- 🔔 **Background notifications** when wishlisted games hit your discount threshold

### Steam Community Market
- 💰 Auto-show **net amount after the 15% market fee** on every listing
- ✂️ **Undercut calculator** for the active item
- 📋 Copy market hash name to clipboard
- 📊 Jump to SteamDB price history

### Inventory
- 💎 **Estimate inventory value** (samples your marketable items)
- 👯 **Find duplicates**
- 📦 **Export inventory JSON**
- 🔗 Quick **"View on Market"** link on the selected item
- 🧮 Trade calculator shortcut

### Trade offers
- 📊 Live **item-count summary** of both sides

### Profile pages
- Shortcut chips to **SteamDB calculator, SteamLadder, Backpack.tf, SteamRep**

### Browser-wide
- 🖱 **Context-menu lookups** — select any game name → "Find lowest price on IsThereAnyDeal" / "Search on SteamDB" / "Check ProtonDB rating"
- 🛟 Floating **SE** badge on every Steam page for quick access to settings
- ⚙️ Full options page + popup with quick toggles
- 🌐 Configurable country / currency

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
- IsThereAnyDeal — only to look up prices for the app you're viewing
- ProtonDB — only on store pages, only for the visible app
- HowLongToBeat — only when you click the HLTB link

No analytics. No background calls except an optional once-per-hour wishlist deal check (off by default).

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
```

No build step — edit a file and click "reload" in `chrome://extensions/`.

## Contributing

Issues and PRs welcome. Please:
- Don't import code from other Steam extensions (license cleanliness matters).
- Keep all DOM injections under the `se-` class prefix.
- Route all `fetch` through the background service worker.

## License

MIT — see [`LICENSE`](LICENSE).

## Acknowledgements

Inspired by the excellent work of the [Augmented Steam](https://github.com/IsThereAnyDeal/AugmentedSteam) and [Steam Inventory Helper](https://chromewebstore.google.com/) communities. This is an independent reimplementation, not a fork.

Trademarks: "Steam" is a trademark of Valve Corporation. This project is not affiliated with or endorsed by Valve.
