# Chrome Web Store listing — Steam Enhancer

## Short description (132 char max)
The all-in-one Steam upgrade: price history, wishlist dashboard, market & inventory tools, regional prices, Steam Deck info.

## Detailed description

**Steam Enhancer** brings together the most-loved features of the popular Steam browser extensions into one clean, fast, ad-free Manifest V3 extension: price history and alerts, a wishlist dashboard, market and inventory selling tools, trade-offer values, and more. No telemetry, no account.

### Prices
• Lowest current price across stores and Steam's historical low (powered by IsThereAnyDeal — needs a free API key that you register at isthereanydeal.com/apps/my/ and paste into Options; IsThereAnyDeal requires this of every app that uses their API)
• Interactive price-history chart: three years of Steam prices, hover for date and price, 3M / 1Y / All
• Regional prices converted into your currency, cheapest first, compared with your own price
• Price alerts set right on the game page or the wishlist, checked in the background
• Bundle check: buying separately vs. the bundle price
• Historical-low tag on every search result
• Optional alert when a wishlisted game is near its historical low; mute alerts game by game
• How long the current price has held and when it last dropped

### Store pages
• Steam Deck compatibility and ProtonDB rating
• Your own achievement progress (with your own Steam Web API key), achievement stats, live player count
• Review breakdown, most-helpful review, possible review-bomb flag, live review filter — in any Steam language
• Owned-DLC highlighting, trading-card links, private per-game notes, HowLongToBeat and SteamDB shortcuts
• Full list of achievements with global unlock percentages

### Wishlist dashboard
• One table for your whole wishlist: price, discount, historical low, reviews, Steam Deck status, alert price
• Totals: cost now vs. full price, games on sale, at their historical low or at your target
• Search, sort, filter; export to CSV or JSON
• Hourly background check of the whole wishlist, each deal announced once

### Market and inventory
• What you actually receive after Steam's fees, on every listing
• Quick sell (one cent under the cheapest listing) and Instant sell (to the highest buy order)
• Check your active listings: see which are the cheapest and which were undercut, and remove several at once
• Multi-select selling and list-at-median, always in your wallet currency with a "buyer pays / you receive" preview — nothing is listed without your explicit confirm click
• Mass-list can keep a number of copies of each item
• Inventory value with a value-over-time chart, duplicates, sort by value, rarity breakdown
• Private notes per inventory item, kept in your browser
• Market price-history chart, buy-order helper, currency converter
• Works on Steam's new Market Beta pages: undercut, buy-order helper and instant sell from the order book

### Trade offers
• Item-by-item value table for both sides, including Steam items such as trading cards
• Local trade history per partner, kept only in your browser

### And more
• Notification center in the toolbar popup with quiet hours
• Settings page with search, presets (Minimal, Deal hunter, Trader, Everything) and full backup and restore
• "Report a problem": a copy-only diagnostic (nothing is sent) and a note when a tool can't find its place after Steam changes a page
• Better keyboard focus, dialogs and contrast
• Highlight owned, wishlisted and ignored games; hide the ones you don't want to see
• Library value estimate, badge summary, profile shortcuts
• English, Hebrew (RTL), Russian, German and Portuguese (Brazil)

### Privacy first
Steam Enhancer **does not collect, transmit, or sell any personal data**. There is no analytics, no remote server, no account required. Everything is stored in your own browser.

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
| `storage` | Keep your settings (synced through your Chrome profile) and the data the extension builds for you — notes, alert prices, histories — plus a cache of price/API responses, all in your own browser. |
| `alarms` | Schedule the optional background checks (wishlist deals, price alerts, free promos) and the cache cleanup. |
| `contextMenus` | Right-click on any selected text to look it up on IsThereAnyDeal, SteamDB, or ProtonDB (opens in a new tab). |
| `notifications` | Show desktop alerts when a wishlisted game hits your discount threshold or price target (only when you turn those features on). |
| Host: `*.steampowered.com`, `*.steamcommunity.com` | The whole point of the extension: read and add to Steam pages, and call Steam's own store, wishlist and market endpoints with your existing Steam session. |
| Host: `api.steampowered.com` | Public Steam Web API endpoints for player counts, achievement percentages, wishlists and store details; and, only with your own key, the friends / your-achievements lookups. |
| Host: `api.isthereanydeal.com` | Look up cross-store prices, historical lows and price history, using your own free API key. |
| Host: `*.protondb.com` | Fetch the public Steam Deck / Linux compatibility rating for the game you're viewing. |
| Host: `open.er-api.com` | Exchange rates for regional prices, the display currency and the currency converter. |

Links to other sites (SteamDB, HowLongToBeat, Barter.vg, …) are plain links opened by you; the extension makes no requests to them.
