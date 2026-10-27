# Chrome Web Store listing — Steam Enhancer

## Short description (132 char max)
The all-in-one Steam upgrade: price history, wishlist tools, market & inventory helpers, regional pricing, ProtonDB, and more.

## Detailed description

**Steam Enhancer** brings together the most-loved features of the popular Steam browser extensions into one clean, fast, ad-free Manifest V3 extension: price history and lowest-price alerts, wishlist tools, market and inventory helpers, trade-offer summaries, and more. No telemetry, no account.

### Price intelligence
• Current lowest price across stores and the historical low, with shop, date, discount and an inline price-history chart (powered by IsThereAnyDeal — requires a free API key that you register at isthereanydeal.com/apps/my/ and paste into Options; IsThereAnyDeal requires this of every app that uses their API)
• Price alerts: set a target price right on the game page and get a notification when it is hit
• Free-for-a-limited-time promo notifications
• Regional pricing comparison (US / AR / TR / RU / IN / BR) and an optional second display currency
• Bundle savings check: buying separately vs. the bundle price
• Historical-low badge on every search result

### Store-page widgets
• ProtonDB rating for Steam Deck / Linux players
• HowLongToBeat shortcut
• Live player count, achievement stats and review breakdown
• Possible review-bomb flag and a live review filter (minimum playtime, length, recommended / not recommended)
• Owned-DLC highlighting, trading-card links, private per-game notes
• Shortcuts to SteamDB, SteamCharts, Barter.vg, SteamSpy and more
• Optional "owned by friends" count (uses your own Steam Web API key)

### Search, specials and sales
• Highlight owned, wishlisted and ignored games
• Optionally hide owned or ignored entries

### Wishlist
• Export to CSV, JSON or clipboard text
• Open the whole wishlist as a batch on IsThereAnyDeal
• Per-row price targets with optional background notifications

### Steam Community Market
• Net amount after fees on every listing
• Undercut calculator and buy-order helper
• Price-history chart and a built-in currency converter

### Inventory
• Estimate total inventory value, with a value-over-time chart
• Find duplicates, sort by value, group by type
• Multi-select selling that shows a confirmation first; nothing is listed without your explicit click
• Export inventory as JSON

### Trade offers
• Item-by-item value table for both sides
• Local trade history per partner, kept only in your browser

### Profile, library and badges
• Library size and value estimate, badge and XP summary
• Shortcuts to SteamDB, SteamLadder, Backpack.tf and SteamRep

### Languages
English, Hebrew (RTL), Russian, German and Portuguese (Brazil).

### Privacy first
Steam Enhancer **does not collect, transmit, or sell any personal data**. There is no analytics, no remote server, no account required. Settings are stored in your browser via Chrome's standard sync storage.

### Open source
Steam Enhancer is MIT-licensed and developed openly on GitHub: https://github.com/DrummingBird1/steam-enhancer

---

**Disclaimer:** Steam Enhancer is an unofficial enhancement tool. It is not affiliated with, endorsed by, or sponsored by Valve Corporation, Augmented Steam, or Steam Inventory Helper. "Steam" is a trademark of Valve Corporation.

Translated listings (Hebrew, German, Portuguese-Brazil, Russian): see the `listing/` folder.

## Category
Productivity / Shopping

## Languages
English (default), Hebrew, German, Portuguese (Brazil), Russian — see `listing/`

## Single-purpose description (Chrome Web Store form)
Steam Enhancer adds price-history, wishlist, market and inventory utilities to the Steam Store and Steam Community websites.

## Permission justifications

| Permission | Why we need it |
|---|---|
| `storage` | Persist your settings (toggles, country, threshold) across browsers via Chrome sync, plus cache price/API responses to keep things fast. |
| `alarms` | Schedule the optional background checks (wishlist deals, price targets, free promos). |
| `contextMenus` | Right-click on any selected text to look it up on IsThereAnyDeal, SteamDB, or ProtonDB (opens in a new tab). |
| `notifications` | Show desktop alerts when wishlisted games hit your discount threshold (only when you turn the feature on). |
| Host: `*.steampowered.com`, `*.steamcommunity.com`, `*.steamstatic.com` | The whole point of the extension — to read/decorate Steam pages and call Steam's own dynamicstore / market APIs. |
| Host: `api.isthereanydeal.com`, `isthereanydeal.com` | Look up cross-store prices and historical lows, using your own free API key. |
| Host: `steamdb.info` | Open price-history pages (we link out; no scraping). |
| Host: `*.protondb.com` | Fetch the public Steam Deck / Linux compat rating for the visible app. |
| Host: `*.howlongtobeat.com` | Optional playtime lookup. |
| Host: `api.steampowered.com` | Public Steam Web API endpoints for player count and achievement percentages, plus the opt-in friends-ownership lookup (with your own key). |
| Host: `open.er-api.com` | Currency conversion for the built-in converter and optional display-currency feature. |
