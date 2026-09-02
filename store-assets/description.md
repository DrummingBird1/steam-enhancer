# Chrome Web Store listing — Steam Enhancer

## Short description (132 char max)
The all-in-one Steam upgrade: price history, wishlist tools, market & inventory helpers, regional pricing, ProtonDB, and more.

## Detailed description

**Steam Enhancer** brings together the most-loved features from the popular Steam browser extensions — price history, lowest-price alerts, wishlist exports, market & inventory tools — into one clean, fast, ad-free Manifest V3 extension.

### Price intelligence
• Current lowest price across all stores (powered by IsThereAnyDeal — requires a free API key you register in one click at isthereanydeal.com/apps/my/ and paste into Options; IsThereAnyDeal requires this of every app that uses their API)
• Historical low with shop, date, and discount, plus a price-history chart
• Regional pricing comparison (US / AR / TR / RU / IN / BR)
• Inline "currently at all-time low ✓" tags on search rows
• Available in English, Hebrew, Russian, German, and Portuguese (Brazil)

### Wishlist superpowers
• One-click export to CSV, JSON or clipboard text
• Open your wishlist as a batch on IsThereAnyDeal
• Optional background notifications when wishlisted games drop below your discount threshold

### Store-page widgets
• ProtonDB rating for Steam Deck / Linux players
• HowLongToBeat shortcut
• Live player count and global achievement stats
• Owned-DLC highlighting
• Trading-card market links
• Direct shortcuts to SteamDB, SteamCharts, Barter.vg, SteamRep, SteamLadder

### Search & list filtering
• Highlight owned (green), wishlisted (amber), ignored (faded) games
• Optionally hide owned or ignored entries
• Works on search, specials, sales, dynamic store widgets

### Steam Community Market
• Net-after-fee amount shown on every listing
• Undercut calculator
• One-click jump to price history

### Inventory tools
• Estimate total inventory value
• Find duplicate items
• Export inventory as JSON
• Quick "View on Market" shortcut for the selected item

### Trade offers
• Live item-count summary of both sides

### Privacy first
Steam Enhancer **does not collect, transmit, or sell any personal data**. There is no analytics, no remote server, no account required. All settings are stored in your browser via Chrome's standard sync storage.

### Open source
Steam Enhancer is MIT-licensed and developed openly on GitHub. See the link in the support section.

---

**Disclaimer:** Steam Enhancer is an unofficial enhancement tool. It is not affiliated with, endorsed by, or sponsored by Valve Corporation, Augmented Steam, or Steam Inventory Helper. "Steam" is a trademark of Valve Corporation.

## Category
Productivity / Shopping

## Language
English

## Single-purpose description (Chrome Web Store form)
Steam Enhancer adds price-history, wishlist, market and inventory utilities to the Steam Store and Steam Community websites.

## Permission justifications

| Permission | Why we need it |
|---|---|
| `storage` | Persist your settings (toggles, country, threshold) across browsers via Chrome sync, plus cache price/API responses to keep things fast. |
| `alarms` | Schedule the optional hourly wishlist-deal check. |
| `contextMenus` | Right-click on any selected text to look it up on IsThereAnyDeal, SteamDB, or ProtonDB. |
| `notifications` | Show desktop alerts when wishlisted games hit your discount threshold (only when you turn the feature on). |
| `scripting` | Reserved for dynamic content-script execution on Steam sub-routes; not used to inject into any non-Steam site. |
| `tabs` | Open a new tab for context-menu lookups and keyboard-shortcut actions (e.g. Ctrl+Shift+W opens your wishlist). |
| Host: `*.steampowered.com`, `*.steamcommunity.com`, `*.steamstatic.com` | The whole point of the extension — to read/decorate Steam pages and call Steam's own dynamicstore / market APIs. |
| Host: `api.isthereanydeal.com`, `isthereanydeal.com` | Look up cross-store prices and historical lows, using your own free API key. |
| Host: `steamdb.info` | Open price-history pages (we link out; no scraping). |
| Host: `*.protondb.com` | Fetch the public Steam Deck / Linux compat rating for the visible app. |
| Host: `*.howlongtobeat.com` | Optional playtime lookup. |
| Host: `api.steampowered.com` | Public Steam Web API endpoints for player count and achievement percentages, plus the opt-in friends-ownership lookup (with your own key). |
| Host: `open.er-api.com` | Currency conversion for the built-in converter and optional display-currency feature. |
